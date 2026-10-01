/**
 * Auditoria E2E — distribuição automática de prêmio de Meta batida: quando o
 * resultado do dia bate uma faixa, todo colaborador presente no turno recebe
 * o bônus (GoalPayout na carteira digital + Occurrence "Premiação de Meta"
 * espelhada), escopo COMPANY/SECTOR respeitado, idempotência (não distribui
 * 2x a mesma faixa/período) e estorno automático ao excluir a Occurrence.
 *
 * Requer: `npm run dev` rodando em http://localhost:3000, e
 * scripts/audit-e2e-full-variations.ts já ter rodado pelo menos uma vez
 * (cria a empresa fixture "Pousada Vento Norte (E2E)" + colaboradorA/B).
 * Uso: npx tsx scripts/audit-e2e-goal-rewards.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { check, printSummary, results, loginAs, api, startOfDay } from "./audit-lib"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== AUDITORIA E2E — DISTRIBUIÇÃO AUTOMÁTICA DE PRÊMIO DE META — ${new Date().toISOString()} ===\n`)

  const pousada = await prisma.company.findUniqueOrThrow({ where: { slug: "pousada-vento-norte-e2e" } })
  const pColabA = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorA@pousada-e2e.teste.com.vc" } })
  const pColabB = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorB@pousada-e2e.teste.com.vc" } })
  const pMaster = await prisma.user.findUniqueOrThrow({ where: { email: "master@pousada-e2e.teste.com.vc" } })
  const pGerente = await prisma.user.findUniqueOrThrow({ where: { email: "gerente@pousada-e2e.teste.com.vc" } })
  const setorHospedagem = await prisma.sector.findUniqueOrThrow({ where: { companyId_name: { companyId: pousada.id, name: "Hospedagem" } } })

  const master = await loginAs(pMaster.email)
  const gerente = await loginAs(pGerente.email)
  const colabA = await loginAs(pColabA.email)
  const colabB = await loginAs(pColabB.email)

  const today = startOfDay()

  // Limpeza — remove fixtures de execuções anteriores pra rodar do zero.
  await prisma.goalPayout.deleteMany({ where: { companyId: pousada.id, goal: { name: { startsWith: "E2E Meta " } } } })
  await prisma.occurrence.deleteMany({ where: { companyId: pousada.id, type: "META", description: { contains: "E2E Meta " } } })
  await prisma.goalRecord.deleteMany({ where: { goal: { companyId: pousada.id, name: { startsWith: "E2E Meta " } } } })
  await prisma.goalTier.deleteMany({ where: { goal: { companyId: pousada.id, name: { startsWith: "E2E Meta " } } } })
  await prisma.goal.deleteMany({ where: { companyId: pousada.id, name: { startsWith: "E2E Meta " } } })
  await prisma.timeEntry.deleteMany({ where: { companyId: pousada.id, userId: { in: [pColabA.id, pColabB.id] }, createdAt: { gte: today } } })

  async function punch(session: Awaited<ReturnType<typeof loginAs>>, lat: number, lng: number) {
    return api(session, "POST", "/api/company/timeclock", { type: "CHECK_IN", latitude: lat, longitude: lng })
  }

  await check("Setup", "Colaboradores A e B batem CHECK_IN hoje (ficam 'presentes')", async () => {
    const lat = Number(pousada.latitude)
    const lng = Number(pousada.longitude)
    const rA = await punch(colabA, lat, lng)
    const rB = await punch(colabB, lat, lng)
    if (rA.status !== 201 || rB.status !== 201) return `status A=${rA.status} B=${rB.status}`
    return true
  })

  let companyGoalId = ""
  await check("Setup", "Master cria Meta COMPANY/DAILY com 1 faixa (alvo R$10, bônus R$5)", async () => {
    const { status, json } = await api(master, "POST", "/api/company/goals", {
      scope: "COMPANY",
      period: "DAILY",
      name: "E2E Meta Distribuição Equipe",
      tiers: [{ targetAmount: 10, bonusAmount: 5, rewardType: "CASH" }],
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    companyGoalId = json.id
    return true
  })

  await check("Distribuicao", "Gerente lança resultado do dia (R$10) -> bate a faixa", async () => {
    const body = new FormData()
    body.set("amount", "10")
    const { status, json } = await api(gerente, "POST", `/api/company/goals/${companyGoalId}/records`, body, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("Distribuicao", "Escopo COMPANY: GoalPayout criado pros 2 colaboradores presentes (R$5 cada)", async () => {
    // best-effort: a distribuição roda depois do upsert do GoalRecord, dá uma folga pro await terminar do lado do servidor
    await new Promise((r) => setTimeout(r, 300))
    const payouts = await prisma.goalPayout.findMany({ where: { goalId: companyGoalId } })
    if (payouts.length !== 2) return `esperado 2 GoalPayout, veio ${payouts.length}`
    const ids = payouts.map((p) => p.employeeId).sort()
    if (JSON.stringify(ids) !== JSON.stringify([pColabA.id, pColabB.id].sort())) return "colaboradores errados"
    if (payouts.some((p) => Number(p.amount) !== 5 || p.status !== "PAID")) return "valor/status incorretos"
    return true
  })

  await check("Distribuicao", "Occurrence 'Premiação de Meta' (type=META) criada e ligada ao GoalPayout", async () => {
    const occA = await prisma.occurrence.findFirst({ where: { companyId: pousada.id, employeeId: pColabA.id, type: "META", description: { contains: "E2E Meta Distribuição" } } })
    if (!occA) return "occurrence não encontrada pro colaborador A"
    if (Number(occA.total) !== 5) return `total esperado 5, veio ${occA.total}`
    const payout = await prisma.goalPayout.findFirst({ where: { occurrenceId: occA.id } })
    if (!payout) return "GoalPayout não está ligado via occurrenceId"
    return true
  })

  await check("Distribuicao", "Notification BONUS_AWARDED enviada pros 2 colaboradores", async () => {
    const [nA, nB] = await Promise.all([
      prisma.notification.findFirst({ where: { userId: pColabA.id, type: "BONUS_AWARDED", createdAt: { gte: new Date(Date.now() - 60000) } }, orderBy: { createdAt: "desc" } }),
      prisma.notification.findFirst({ where: { userId: pColabB.id, type: "BONUS_AWARDED", createdAt: { gte: new Date(Date.now() - 60000) } }, orderBy: { createdAt: "desc" } }),
    ])
    if (!nA || !nB) return "notificação faltando pra A ou B"
    return true
  })

  await check("Distribuicao", "Idempotência: lançar o mesmo resultado de novo NÃO duplica o GoalPayout", async () => {
    const body = new FormData()
    body.set("amount", "10")
    const { status } = await api(gerente, "POST", `/api/company/goals/${companyGoalId}/records`, body, true)
    if (status !== 201) return `status ${status}`
    await new Promise((r) => setTimeout(r, 300))
    const payouts = await prisma.goalPayout.findMany({ where: { goalId: companyGoalId } })
    if (payouts.length !== 2) return `esperado continuar em 2, veio ${payouts.length}`
    return true
  })

  let occurrenceToDeleteId = ""
  await check("Estorno", "Master exclui a Occurrence de Premiação -> GoalPayout é estornado junto", async () => {
    const occA = await prisma.occurrence.findFirstOrThrow({ where: { companyId: pousada.id, employeeId: pColabA.id, type: "META", description: { contains: "E2E Meta Distribuição" } } })
    occurrenceToDeleteId = occA.id
    const { status } = await api(master, "DELETE", `/api/company/occurrences/${occA.id}`)
    if (status !== 200) return `status ${status}`
    const payout = await prisma.goalPayout.findFirst({ where: { occurrenceId: occurrenceToDeleteId } })
    if (payout) return "GoalPayout ainda existe depois da exclusão"
    const stillThere = await prisma.goalPayout.findFirst({ where: { goalId: companyGoalId, employeeId: pColabA.id } })
    if (stillThere) return "GoalPayout do colaborador A não foi removido"
    const bStillThere = await prisma.goalPayout.findFirst({ where: { goalId: companyGoalId, employeeId: pColabB.id } })
    if (!bStillThere) return "estorno não deveria ter afetado o GoalPayout do colaborador B"
    return true
  })

  let sectorGoalId = ""
  await check("Setup", "Master cria Meta SECTOR(Hospedagem)/DAILY com 1 faixa (alvo R$10, bônus R$7)", async () => {
    const { status, json } = await api(master, "POST", "/api/company/goals", {
      scope: "SECTOR",
      sectorId: setorHospedagem.id,
      period: "DAILY",
      name: "E2E Meta Distribuição Setor",
      tiers: [{ targetAmount: 10, bonusAmount: 7, rewardType: "CASH" }],
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    sectorGoalId = json.id
    return true
  })

  await check("Distribuicao", "Escopo SECTOR: lança resultado -> só o colaborador do setor (A) recebe, B não", async () => {
    const body = new FormData()
    body.set("amount", "10")
    const { status } = await api(gerente, "POST", `/api/company/goals/${sectorGoalId}/records`, body, true)
    if (status !== 201) return `status ${status}`
    await new Promise((r) => setTimeout(r, 300))
    const payouts = await prisma.goalPayout.findMany({ where: { goalId: sectorGoalId } })
    if (payouts.length !== 1) return `esperado 1 GoalPayout (só setor Hospedagem), veio ${payouts.length}`
    if (payouts[0].employeeId !== pColabA.id) return "foi pro colaborador errado"
    return true
  })

  printSummary("DISTRIBUIÇÃO AUTOMÁTICA DE PRÊMIO DE META")

  // Limpeza final — desativa as metas de teste pra não ficarem poluindo a lista de metas ativas da Pousada.
  await prisma.goal.updateMany({ where: { id: { in: [companyGoalId, sectorGoalId] } }, data: { active: false } })
  console.log("✓ Metas de teste desativadas (active=false)")

  if (results.some((r) => !r.pass)) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
