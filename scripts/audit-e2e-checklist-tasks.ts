/**
 * Auditoria E2E — Tarefas Livres/Setor/Tag ("Vou Fazer" -> "Concluir"),
 * auto-aprovação (requiresApproval=false), Recusar/Reabrir com reversão de
 * XP, e quitação de ocorrências no Financeiro pela Gerente (seção 1 do
 * pacote de Checklists/Financeiro).
 *
 * Requer: `npm run dev` rodando, e scripts/audit-e2e-full-variations.ts já
 * ter rodado pelo menos uma vez (cria a Pousada Vento Norte (E2E) +
 * colaboradorA/B, setor Hospedagem).
 * Uso: npx tsx scripts/audit-e2e-checklist-tasks.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { check, printSummary, results, loginAs, api, startOfDay, settleForm } from "./audit-lib"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== AUDITORIA E2E — TAREFAS LIVRES/SETOR/TAG, AUTO-APROVAÇÃO E QUITAÇÃO NO FINANCEIRO — ${new Date().toISOString()} ===\n`)

  const pousada = await prisma.company.findUniqueOrThrow({ where: { slug: "pousada-vento-norte-e2e" } })
  const pColabA = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorA@pousada-e2e.teste.com.vc" } })
  const pColabB = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorB@pousada-e2e.teste.com.vc" } })
  const pGerente = await prisma.user.findUniqueOrThrow({ where: { email: "gerente@pousada-e2e.teste.com.vc" } })

  const colabA = await loginAs(pColabA.email)
  const colabB = await loginAs(pColabB.email)
  const gerente = await loginAs(pGerente.email)
  const today = startOfDay()

  // Limpeza — remove fixtures de execuções anteriores pra rodar do zero.
  await prisma.checklist.deleteMany({ where: { companyId: pousada.id, title: { startsWith: "E2E Task " }, forDate: today } })
  await prisma.checklistTemplate.deleteMany({ where: { companyId: pousada.id, title: { startsWith: "E2E Task " } } })
  await prisma.occurrence.deleteMany({ where: { companyId: pousada.id, employeeId: pColabA.id, description: "E2E mark-paid fixture" } })
  // scripts/audit-e2e-full-variations.ts (FASE F) completa o fechamento de
  // HOJE da Pousada como parte do próprio teste — se já rodou antes deste
  // script no mesmo dia, o teste de Recusar/Reabrir abaixo bateria na trava
  // "dia já fechado" por causa de fixture de OUTRO script, não por bug.
  // Remove esse fechamento (é só fixture de teste) pra testar a reabertura
  // num estado limpo e previsível.
  await prisma.shiftClosing.deleteMany({ where: { companyId: pousada.id, date: today } })

  let freeTemplateId = ""
  await check("Setup", "Gerente cria template FREE/DAILY (requiresApproval=true)", async () => {
    const { status, json } = await api(gerente, "POST", "/api/company/checklists/templates", {
      title: "E2E Task Livre",
      recurrence: "DAILY",
      dueTime: "23:59",
      assignmentType: "FREE",
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    freeTemplateId = json.id
    return true
  })

  let freeChecklistId = ""
  await check("Claim", "Instância de hoje aparece 'claimable' pros 2 colaboradores (employeeId null)", async () => {
    const [rA, rB] = await Promise.all([api(colabA, "GET", "/api/company/checklists"), api(colabB, "GET", "/api/company/checklists")])
    const foundA = rA.json.checklists.find((c: any) => c.title === "E2E Task Livre")
    const foundB = rB.json.checklists.find((c: any) => c.title === "E2E Task Livre")
    if (!foundA || !foundB) return "tarefa não apareceu pra um dos dois"
    if (foundA.employee !== null || foundB.employee !== null) return "deveria estar sem responsável (employee null)"
    freeChecklistId = foundA.id
    return true
  })

  await check("Claim", "Colaborador A reserva com 'Vou Fazer' (POST claim)", async () => {
    const { status, json } = await api(colabA, "POST", `/api/company/checklists/${freeChecklistId}/claim`)
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    if (json.employeeId !== pColabA.id) return "employeeId não ficou com o colaborador A"
    return true
  })

  await check("Claim", "Tarefa some da lista do Colaborador B depois da reserva", async () => {
    const { json } = await api(colabB, "GET", "/api/company/checklists")
    const found = json.checklists.find((c: any) => c.id === freeChecklistId)
    return !found || "ainda aparece pro colaborador B depois de reservada por A"
  })

  await check("Claim", "Colaborador B tentando reservar a mesma tarefa de novo -> 409", async () => {
    const { status } = await api(colabB, "POST", `/api/company/checklists/${freeChecklistId}/claim`)
    return status === 409 || `esperado 409, veio ${status}`
  })

  await check("Claim", "Colaborador A entrega (requiresApproval=true) -> fica SUBMITTED, não APPROVED direto", async () => {
    const form = new FormData()
    form.set("action", "COMPLETE")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "foto.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status, json } = await api(colabA, "POST", `/api/company/checklists/${freeChecklistId}/submit`, form, true)
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.status === "SUBMITTED" || `esperado SUBMITTED, veio ${json.status}`
  })

  // --- Auto-aprovação (requiresApproval=false) ---
  let noApprovalTemplateId = ""
  await check("Setup", "Gerente cria template SECTOR(Hospedagem)/DAILY com requiresApproval=false", async () => {
    const sector = await prisma.sector.findFirstOrThrow({ where: { companyId: pousada.id, name: "Hospedagem" } })
    const { status, json } = await api(gerente, "POST", "/api/company/checklists/templates", {
      title: "E2E Task Setor Sem Aprovacao",
      recurrence: "DAILY",
      dueTime: "23:59",
      assignmentType: "SECTOR",
      targetSectorId: sector.id,
      requiresApproval: false,
      requiresPhoto: false,
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    noApprovalTemplateId = json.id
    return true
  })

  let noApprovalChecklistId = ""
  let xpBefore = 0
  await check("AutoAprovacao", "Colaborador A (do setor Hospedagem) vê e reserva a tarefa", async () => {
    const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    xpBefore = profile.xpPoints
    const { json } = await api(colabA, "GET", "/api/company/checklists")
    const found = json.checklists.find((c: any) => c.title === "E2E Task Setor Sem Aprovacao" && c.employee === null)
    if (!found) return "tarefa não encontrada como claimable pro colaborador A"
    noApprovalChecklistId = found.id
    const claim = await api(colabA, "POST", `/api/company/checklists/${noApprovalChecklistId}/claim`)
    return claim.status === 200 || `claim falhou: ${claim.status}`
  })

  await check("AutoAprovacao", "Entrega sem foto conclui DIRETO (status=APPROVED), credita XP", async () => {
    const form = new FormData()
    form.set("action", "COMPLETE")
    const { status, json } = await api(colabA, "POST", `/api/company/checklists/${noApprovalChecklistId}/submit`, form, true)
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    if (json.status !== "APPROVED") return `esperado APPROVED direto, veio ${json.status}`
    return true
  })

  await check("AutoAprovacao", "XP foi creditado de verdade (xpPoints subiu)", async () => {
    const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    return profile.xpPoints > xpBefore || `xpPoints não subiu (antes=${xpBefore}, depois=${profile.xpPoints})`
  })

  await check("Reabrir", "Gerente 'Recusar/Reabrir' a tarefa já APPROVED -> volta a PENDING e reverte XP", async () => {
    const { status, json } = await api(gerente, "PATCH", `/api/company/checklists/${noApprovalChecklistId}`, {
      status: "RETURNED",
      note: "Teste E2E — reabrindo pra corrigir",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    if (json.status !== "PENDING") return `esperado PENDING, veio ${json.status}`
    const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    return profile.xpPoints === xpBefore || `XP não voltou ao valor original (esperado ${xpBefore}, veio ${profile.xpPoints})`
  })

  // --- Financeiro: Gerente visualiza + quita ocorrência ---
  let occurrenceId = ""
  await check("Financeiro", "Master cria ocorrência de Taxa de Serviço pendente pro colaborador A", async () => {
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "TAXA_SERVICO")
    form.set("value", "50")
    form.set("description", "E2E mark-paid fixture")
    const master = await loginAs((await prisma.user.findFirstOrThrow({ where: { companyId: pousada.id, role: "COMPANY_MASTER" } })).email)
    const { status, json } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    occurrenceId = json.id
    return true
  })

  await check("Financeiro", "Gerente consegue ver /api/company/finance/receivables (não é mais 403)", async () => {
    const { status, json } = await api(gerente, "GET", "/api/company/finance/receivables")
    if (status !== 200) return `status ${status}`
    const row = json.rows.find((r: any) => r.employeeId === pColabA.id)
    const item = row?.items.find((i: any) => i.id === occurrenceId)
    return Boolean(item) || "ocorrência não apareceu nos itens pendentes do colaborador A"
  })

  await check("Financeiro", "Gerente quita a ocorrência (settle, com forma de pagamento + comprovante)", async () => {
    const { status, json } = await api(gerente, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: occurrenceId }, { method: "PIX" }), true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    const paid = await prisma.occurrence.findUniqueOrThrow({ where: { id: occurrenceId } })
    await prisma.financialSettlement.deleteMany({ where: { sourceId: occurrenceId } })
    return paid.paymentStatus === "PAID" || `esperado PAID, veio ${paid.paymentStatus}`
  })

  printSummary("TAREFAS LIVRES/SETOR/TAG, AUTO-APROVAÇÃO E QUITAÇÃO NO FINANCEIRO")

  // Limpeza final — desativa os templates de teste.
  await prisma.checklistTemplate.updateMany({
    where: { id: { in: [freeTemplateId, noApprovalTemplateId].filter(Boolean) } },
    data: { active: false },
  })
  console.log("✓ Templates de teste desativados (active=false)")

  if (results.some((r) => !r.pass)) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
