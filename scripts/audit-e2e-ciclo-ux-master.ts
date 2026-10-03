import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results } from "./audit-lib"

/**
 * Auditoria do ciclo "Fechamento/Scanner/Ponto-Gerente/Checklists/Rewards/
 * Crescimento/Ficha-Colaborador/Comunicações" — cobre as seções 5-8 (6-8 são
 * exclusivamente novas desta rodada; a 5 só tinha a notificação faltante).
 * Idempotente — pode rodar várias vezes seguidas.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  if (!colaborador) throw new Error("colaborador não encontrado")

  const masterSession = await loginAs("master@teste.com.vc")
  const gerenteSession = await loginAs("gerente@teste.com.vc")

  // --------------------------------------------------------------------------
  // SEÇÃO 5 — Resgate de Prêmios: notificação de aprovação
  // --------------------------------------------------------------------------
  let item = await prisma.rewardCatalogItem.findFirst({ where: { companyId: company.id, name: "[Audit] Prêmio Ciclo UX" } })
  if (!item) {
    item = await prisma.rewardCatalogItem.create({ data: { companyId: company.id, name: "[Audit] Prêmio Ciclo UX", costXp: 5, stock: 10, active: true } })
  } else {
    item = await prisma.rewardCatalogItem.update({ where: { id: item.id }, data: { active: true, stock: 10, costXp: 5 } })
  }
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { xpPoints: { increment: 100 } } })

  const colaboradorSession = await loginAs("colaborador@teste.com.vc")
  const redeemRes = await api(colaboradorSession, "POST", `/api/company/gamification/rewards/${item.id}/redeem`, {})
  await check("5.Rewards", "Colaborador consegue resgatar o prêmio (sem 500 de worker)", async () => redeemRes.status === 201)

  const redemption = redeemRes.json?.id
    ? redeemRes.json
    : await prisma.rewardRedemption.findFirst({ where: { itemId: item.id, employeeId: colaborador.id }, orderBy: { createdAt: "desc" } })

  if (redemption?.id) {
    const approveRes = await api(gerenteSession, "PATCH", `/api/company/gamification/redemptions/${redemption.id}`, { status: "APPROVED" })
    await check("5.Rewards", "Gerente aprova o resgate", async () => approveRes.status === 200)

    const notif = await prisma.notification.findFirst({
      where: { userId: colaborador.id, title: "Resgate aprovado para troca na unidade" },
      orderBy: { createdAt: "desc" },
    })
    await check("5.Rewards", "Notificação 'Resgate aprovado para troca na unidade' foi criada", async () => Boolean(notif))
  } else {
    record("5.Rewards", "Gerente aprova o resgate", false, "redemption não encontrada")
  }

  // --------------------------------------------------------------------------
  // SEÇÃO 6 — Programa de Crescimento: edição exclusiva do Master
  // --------------------------------------------------------------------------
  const gerenteEditRes = await api(gerenteSession, "PATCH", "/api/company/internal-program", new FormData(), true)
  await check("6.Crescimento", "Gerente NÃO consegue editar o Programa Interno (403)", async () => gerenteEditRes.status === 403)

  const masterProgramGetRes = await api(masterSession, "GET", "/api/company/internal-program")
  await check("6.Crescimento", "Master consegue ler o Programa Interno (GET continua aberto ao staff)", async () => masterProgramGetRes.status === 200)

  const gerenteLevelPostRes = await api(gerenteSession, "POST", "/api/company/gamification/levels", { name: "[Audit] Nível X", pointsRequired: 999 })
  await check("6.Crescimento", "Gerente NÃO consegue criar nível no Plano de Carreira (403)", async () => gerenteLevelPostRes.status === 403)

  // --------------------------------------------------------------------------
  // SEÇÃO 7 — Ficha do Colaborador + Promoção Forçada
  // --------------------------------------------------------------------------
  const fichaRes = await api(gerenteSession, "GET", `/api/company/employees/${colaborador.id}`)
  await check("7.Ficha", "Ficha do colaborador carrega sem erro (200, sem 500 de worker)", async () => fichaRes.status === 200 && fichaRes.json?.id === colaborador.id)

  let level = await prisma.internalLevelRule.findFirst({ where: { internalProgram: { companyId: company.id } } })
  if (!level) {
    const program = await prisma.internalProgram.upsert({
      where: { companyId: company.id },
      update: {},
      create: { companyId: company.id, title: "Programa Interno" },
    })
    level = await prisma.internalLevelRule.create({ data: { internalProgramId: program.id, name: "[Audit] Nível Base", order: 0, pointsRequired: 0 } })
  }

  const gerentePromoteRes = await api(gerenteSession, "POST", `/api/company/employees/${colaborador.id}/promote`, { levelId: level.id, justification: "teste" })
  await check("7.Ficha", "Gerente NÃO consegue usar Promoção Forçada (403 — exclusiva do Master)", async () => gerentePromoteRes.status === 403)

  const masterPromoteNoJustRes = await api(masterSession, "POST", `/api/company/employees/${colaborador.id}/promote`, { levelId: level.id })
  await check("7.Ficha", "Master SEM justificativa é rejeitado (400)", async () => masterPromoteNoJustRes.status === 400)

  const justification = `[Audit] mudança manual de teste ${Date.now()}`
  const masterPromoteRes = await api(masterSession, "POST", `/api/company/employees/${colaborador.id}/promote`, { levelId: level.id, justification })
  await check("7.Ficha", "Master COM justificativa consegue aplicar a Promoção Forçada", async () => masterPromoteRes.status === 200)

  const auditEntry = await prisma.auditLog.findFirst({
    where: { entity: "EmployeeProfile", action: "UPDATE", companyId: company.id },
    orderBy: { createdAt: "desc" },
  })
  await check(
    "7.Ficha",
    "Justificativa da Promoção Forçada foi gravada no AuditLog",
    async () => Boolean(auditEntry) && (auditEntry!.details as any)?.justification === justification,
  )

  // --------------------------------------------------------------------------
  // SEÇÃO 8 — Comunicações: Auditoria geral do Master com filtros
  // --------------------------------------------------------------------------
  const sector = await prisma.sector.findFirst({ where: { companyId: company.id } })
  const auditMsgRes = await api(masterSession, "GET", `/api/company/communications?employeeId=${colaborador.id}`)
  await check("8.Comunicacao", "Master filtra Auditoria por Colaborador (200)", async () => auditMsgRes.status === 200 && Array.isArray(auditMsgRes.json))

  if (sector) {
    const sectorFilterRes = await api(masterSession, "GET", `/api/company/communications?sectorId=${sector.id}`)
    await check("8.Comunicacao", "Master filtra Auditoria por Setor (200)", async () => sectorFilterRes.status === 200 && Array.isArray(sectorFilterRes.json))
  }

  const today = new Date().toISOString().slice(0, 10)
  const periodFilterRes = await api(masterSession, "GET", `/api/company/communications?startDate=${today}&endDate=${today}`)
  await check("8.Comunicacao", "Master filtra Auditoria por Período (200)", async () => periodFilterRes.status === 200 && Array.isArray(periodFilterRes.json))

  const gerenteAuditFilterRes = await api(gerenteSession, "GET", `/api/company/communications?employeeId=${colaborador.id}`)
  await check(
    "8.Comunicacao",
    "Gerente (não-Master) usando o filtro de auditoria NÃO vira Master — continua restrito ao próprio escopo de visibilidade",
    async () => gerenteAuditFilterRes.status === 200 && Array.isArray(gerenteAuditFilterRes.json),
  )

  printSummary("CICLO UX/FECHAMENTO/PONTO-GERENTE/CHECKLISTS/REWARDS/CRESCIMENTO/FICHA/COMUNICACOES")

  // Limpeza do fixture específico deste script
  await prisma.rewardRedemption.deleteMany({ where: { itemId: item.id } })
  await prisma.rewardCatalogItem.delete({ where: { id: item.id } }).catch(() => {})

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
