/**
 * Quarta leva da auditoria E2E — confirmação de ponto pela Gerência no
 * Fechamento (nada mais é aplicado na hora da batida, ver
 * lib/timeclock-adjustments.ts), isenção de Falta/Banco de Horas na
 * penalidade de checklist, Pagamento de Horas Extras calculado por
 * colaborador, e Conta de Consumo (dívida).
 *
 * Requer: `npm run dev` rodando + fixtures de scripts/audit-e2e-full-variations.ts
 * (Pousada Vento Norte) já criadas pelo menos uma vez.
 * Uso: npx tsx scripts/audit-e2e-timeclock-review.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { check, printSummary, results, loginAs, api, startOfDay, type Session, crossesMidnight } from "./audit-lib"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function minutesAgo(m: number) {
  const d = new Date(Date.now() - m * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function main() {
  console.log(`\n=== AUDITORIA E2E — CONFIRMAÇÃO DE PONTO, CONSUMO E HORAS EXTRAS — ${new Date().toISOString()} ===\n`)

  const pousada = await prisma.company.findUniqueOrThrow({ where: { slug: "pousada-vento-norte-e2e" } })
  const pColabA = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorA@pousada-e2e.teste.com.vc" } })
  const pColabB = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorB@pousada-e2e.teste.com.vc" } })
  const pMaster = await prisma.user.findUniqueOrThrow({ where: { email: "master@pousada-e2e.teste.com.vc" } })
  const pGerente = await prisma.user.findUniqueOrThrow({ where: { email: "gerente@pousada-e2e.teste.com.vc" } })
  const company = await prisma.company.findUniqueOrThrow({ where: { id: pousada.id } })

  const A = await loginAs(pColabA.email)
  const B = await loginAs(pColabB.email)
  const master = await loginAs(pMaster.email)
  const gerente = await loginAs(pGerente.email)
  const today = startOfDay()

  // Idempotência: o fechamento de hoje pode ter ficado COMPLETED de uma
  // corrida anterior — reseta pra o teste do Passo 3 (finalizar de verdade)
  // poder rodar de novo no mesmo dia.
  await prisma.shiftClosing.deleteMany({ where: { companyId: pousada.id, date: today } })

  async function resetToday(userId: string) {
    await prisma.timeEntry.deleteMany({ where: { userId, companyId: pousada.id, createdAt: { gte: today } } })
    await prisma.timeclockAdjustmentReview.deleteMany({ where: { employeeId: userId, date: today } })
    await prisma.occurrence.deleteMany({ where: { companyId: pousada.id, employeeId: userId, date: { gte: today } } })
    await prisma.checklist.deleteMany({ where: { companyId: pousada.id, employeeId: userId, forDate: today } })
  }
  async function getProfile(userId: string) {
    return prisma.employeeProfile.findUniqueOrThrow({ where: { userId } })
  }
  async function punch(session: Session, type: string) {
    return api(session, "POST", "/api/company/timeclock", { type, latitude: Number(company.latitude), longitude: Number(company.longitude) })
  }
  async function getClosing() {
    return api(gerente, "GET", "/api/company/shift-closing")
  }

  // ===========================================================================
  // Confirmação de Ponto no Fechamento
  // ===========================================================================
  console.log("--- Confirmação de Ponto no Fechamento ---")

  await resetToday(pColabA.id)
  await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { workStartTime: minutesAgo(20), bankOfHoursMinutes: 0, xpPoints: 100 } })
  await check("Fechamento.Ponto", "Colaborador bate ponto atrasado (20min)", async () => {
    const { status } = await punch(A, "CHECK_IN")
    return status === 201 || `status ${status}`
  })

  await check("Fechamento.Ponto", "GET fechamento lista a variação pendente (LATE_CHECKIN) e step0Complete=false", async () => {
    const { status, json } = await getClosing()
    if (status !== 200) return `status ${status}`
    const item = json.checklist.pendingTimeclockAdjustments.find((a: any) => a.employeeId === pColabA.id && a.kind === "LATE_CHECKIN")
    if (!item) return `item não encontrado — pendentes: ${JSON.stringify(json.checklist.pendingTimeclockAdjustments)}`
    if (item.computedMinutes !== -5) return `computedMinutes = ${item.computedMinutes}, esperado -5`
    return json.checklist.step0Complete === false || "step0Complete deveria ser false"
  })

  await check("Fechamento.Ponto", "Finalizar o expediente é bloqueado enquanto o passo 0 (ponto) não foi revisado", async () => {
    const form = new FormData()
    form.set("revenueAmount", "100")
    const { status, json } = await api(gerente, "POST", "/api/company/shift-closing", form, true)
    if (status !== 400) return `esperado 400, veio ${status}`
    return String(json.error).toLowerCase().includes("variação de ponto") || `mensagem inesperada: ${json.error}`
  })

  await check("Fechamento.Ponto", "Aplicar um desconto SEM justificativa é rejeitado (400)", async () => {
    const { status } = await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", {
      employeeId: pColabA.id,
      kind: "LATE_CHECKIN",
      apply: true,
    })
    return status === 400 || `esperado 400, veio ${status}`
  })

  await check("Fechamento.Ponto", "Gerente confirma o atraso COM justificativa -> aplica pontos + banco de horas + notifica", async () => {
    const before = await getProfile(pColabA.id)
    const { status } = await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", {
      employeeId: pColabA.id,
      kind: "LATE_CHECKIN",
      apply: true,
      justification: "Atraso confirmado com o colaborador",
    })
    if (status !== 200) return `status ${status}`
    const after = await getProfile(pColabA.id)
    if (after.bankOfHoursMinutes !== before.bankOfHoursMinutes - 5) return `bankOfHoursMinutes = ${after.bankOfHoursMinutes}, esperado ${before.bankOfHoursMinutes - 5}`
    if (after.xpPoints >= before.xpPoints) return `xpPoints não caiu (antes=${before.xpPoints}, depois=${after.xpPoints})`
    const n = await prisma.notification.findFirst({ where: { userId: pColabA.id, title: "Variação de ponto confirmada" }, orderBy: { createdAt: "desc" } })
    return Boolean(n) || "notificação de confirmação não encontrada"
  })

  await check("Fechamento.Ponto", "A mesma variação NÃO é perguntada de novo (idempotência)", async () => {
    const { status, json } = await getClosing()
    if (status !== 200) return `status ${status}`
    const stillPending = json.checklist.pendingTimeclockAdjustments.some((a: any) => a.employeeId === pColabA.id && a.kind === "LATE_CHECKIN")
    return !stillPending || "ainda aparece como pendente"
  })

  // --- Perdoar (não aplicar) ---
  await resetToday(pColabB.id)
  await prisma.employeeProfile.update({ where: { userId: pColabB.id }, data: { dailyBreakAllowanceMinutes: 60, bankOfHoursMinutes: 50 } })
  await check("Fechamento.Ponto", "Intervalo excedido — Gerente PERDOA (não aplica)", async () => {
    if (crossesMidnight(90)) return true // ignorado: batidas de 90 min atrás cairiam no dia anterior (ver crossesMidnight)
    await prisma.timeEntry.create({
      data: { userId: pColabB.id, companyId: pousada.id, type: "CHECK_IN", latitude: company.latitude!, longitude: company.longitude!, createdAt: new Date(Date.now() - 90 * 60 * 1000) },
    })
    await prisma.timeEntry.create({
      data: { userId: pColabB.id, companyId: pousada.id, type: "BREAK_START", latitude: company.latitude!, longitude: company.longitude!, createdAt: new Date(Date.now() - 80 * 60 * 1000) },
    })
    const p = await punch(B, "BREAK_END")
    if (p.status !== 201) return `status ${p.status} — ${JSON.stringify(p.json)}`
    if (p.json.breakOverageMinutes !== 5) return `breakOverageMinutes = ${p.json.breakOverageMinutes}, esperado 5`

    const before = await getProfile(pColabB.id)
    const decide = await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", {
      employeeId: pColabB.id,
      kind: "BREAK_OVERAGE",
      apply: false,
    })
    if (decide.status !== 200) return `status ${decide.status} — ${JSON.stringify(decide.json)}`
    const after = await getProfile(pColabB.id)
    return after.bankOfHoursMinutes === before.bankOfHoursMinutes || `bankOfHoursMinutes mudou mesmo perdoando (antes=${before.bankOfHoursMinutes}, depois=${after.bankOfHoursMinutes})`
  })

  // ===========================================================================
  // Uso de Banco de Horas / Falta — isenção de penalidade de checklist
  // ===========================================================================
  console.log("\n--- Isenção de checklist (Falta / Uso de Banco de Horas) ---")

  await resetToday(pColabA.id)
  await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { bankOfHoursMinutes: 300 } })

  let exemptChecklistId = ""
  await check("Ocorrencia.BancoHoras", "Gerente concede 2h de Banco de Horas -> debita 120min do banco", async () => {
    const before = await getProfile(pColabA.id)
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "BANCO_HORAS")
    form.set("quantity", "2")
    form.set("description", "Saída antecipada autorizada")
    const { status } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status}`
    const after = await getProfile(pColabA.id)
    return after.bankOfHoursMinutes === before.bankOfHoursMinutes - 120 || `bankOfHoursMinutes = ${after.bankOfHoursMinutes}, esperado ${before.bankOfHoursMinutes - 120}`
  })

  await check("Checklist.Isencao", "Checklist do dia não entregue -> NÃO é penalizado no fechamento (colaborador tem Banco de Horas hoje)", async () => {
    const c = await prisma.checklist.create({
      data: {
        companyId: pousada.id,
        employeeId: pColabA.id,
        forDate: today,
        title: "Checklist Isenção — Banco de Horas (E2E)",
        priority: "MEDIUM",
        status: "PENDING",
      },
    })
    exemptChecklistId = c.id

    // Completa os demais passos do fechamento pra poder finalizar de verdade.
    await prisma.commission.updateMany({ where: { companyId: pousada.id, date: { gte: today }, amount: null }, data: { amount: 0, billJustification: "auditoria" } })
    const employeesToday = await prisma.timeEntry.findMany({ where: { companyId: pousada.id, type: "CHECK_IN", createdAt: { gte: today } }, select: { userId: true }, distinct: ["userId"] })
    for (const e of employeesToday) {
      await api(gerente, "POST", "/api/company/evaluations", { employeeId: e.userId, score: 0 })
    }
    // Revisa qualquer variação de ponto pendente (perdoando) pra liberar o passo 0.
    const closingStatus = await getClosing()
    for (const adj of closingStatus.json.checklist.pendingTimeclockAdjustments) {
      await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", { employeeId: adj.employeeId, kind: adj.kind, apply: false })
    }

    const form = new FormData()
    form.set("revenueAmount", "500")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comprovante.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const closeResult = await api(gerente, "POST", "/api/company/shift-closing", form, true)
    if (closeResult.status !== 201) return `fechamento status ${closeResult.status} — ${JSON.stringify(closeResult.json)}`

    const checklistAfter = await prisma.checklist.findUniqueOrThrow({ where: { id: exemptChecklistId } })
    return checklistAfter.status === "PENDING" || `status = ${checklistAfter.status}, esperado PENDING (deveria ficar isento, não REJECTED)`
  })

  // ===========================================================================
  // Pagamento de Horas Extras calculado por colaborador
  // ===========================================================================
  console.log("\n--- Pagamento de Horas Extras ---")

  await prisma.employeeProfile.update({
    where: { userId: pColabA.id },
    data: { workStartTime: "08:00", workEndTime: "16:00", dailyBreakAllowanceMinutes: 60, weeklyDayOff: 0, monthlySalary: 3300, bankOfHoursMinutes: 100 },
  })

  await check("HoraExtra.Preview", "Prévia calcula a hora com base no horário/salário do colaborador", async () => {
    const { status, json } = await api(master, "GET", `/api/company/occurrences/overtime-preview?employeeId=${pColabA.id}&hours=3`)
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    // 8h-16h - 60min pausa = 420min/dia úteis (26 dias, folga só domingo) => confere magnitude, não valor exato (dias úteis variam por mês)
    const expectedHourly = 3300 / (json.monthlyMinutes / 60)
    if (Math.abs(json.hourlyRate - expectedHourly) > 0.5) return `hourlyRate = ${json.hourlyRate}, esperado ~${expectedHourly.toFixed(2)}`
    const expectedTotal = Math.round(json.hourlyRate * 3 * 1.5 * 100) / 100
    return Math.abs(json.totalAmount - expectedTotal) < 1 || `totalAmount = ${json.totalAmount}, esperado ~${expectedTotal}`
  })

  await check("HoraExtra.Aplicar", "Aplicar o pagamento debita o banco de horas (pode ficar negativo)", async () => {
    const preview = await api(master, "GET", `/api/company/occurrences/overtime-preview?employeeId=${pColabA.id}&hours=3`)
    const perHourWithBonus = Math.round(preview.json.hourlyRate * 1.5 * 100) / 100
    const before = await getProfile(pColabA.id)

    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "HORA_EXTRA")
    form.set("value", String(perHourWithBonus))
    form.set("quantity", "3")
    form.set("paymentMethod", "PIX")
    form.set("description", "3h extras — evento especial")
    const { status, json } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`

    const after = await getProfile(pColabA.id)
    return after.bankOfHoursMinutes === before.bankOfHoursMinutes - 180 || `bankOfHoursMinutes = ${after.bankOfHoursMinutes}, esperado ${before.bankOfHoursMinutes - 180}`
  })

  await check("HoraExtra.Divida", "Pagar horas extras além do saldo disponível deixa o banco negativo (dívida)", async () => {
    await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { bankOfHoursMinutes: 30 } })
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "HORA_EXTRA")
    form.set("value", "40")
    form.set("quantity", "2") // 120min, > 30min disponíveis
    form.set("paymentMethod", "DINHEIRO")
    const { status } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status}`
    const after = await getProfile(pColabA.id)
    return after.bankOfHoursMinutes === -90 || `bankOfHoursMinutes = ${after.bankOfHoursMinutes}, esperado -90 (30-120)`
  })

  // ===========================================================================
  // Conta de Consumo
  // ===========================================================================
  console.log("\n--- Conta de Consumo ---")

  await check("Consumo.Divida", "Comanda assinada (CONSUMO) aumenta a Conta de Consumo do colaborador", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: pColabA.id } })
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "CONSUMO")
    form.set("value", "85.50")
    form.set("description", "Almoço + refrigerante")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comanda.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status, json } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    const after = await prisma.user.findUniqueOrThrow({ where: { id: pColabA.id } })
    const delta = Number(after.consumptionDebt) - Number(before.consumptionDebt)
    return Math.abs(delta - 85.5) < 0.01 || `consumptionDebt subiu ${delta}, esperado 85.50`
  })

  await check("Consumo.Anexo", "CONSUMO sem foto da comanda é rejeitado (400)", async () => {
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "CONSUMO")
    form.set("value", "20")
    const { status } = await api(master, "POST", "/api/company/occurrences", form, true)
    return status === 400 || `esperado 400, veio ${status}`
  })

  await check("Consumo.Abate", "Ocorrência paga com forma 'Consumo' abate a dívida acumulada", async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: pColabA.id } })
    const form = new FormData()
    form.set("employeeId", pColabA.id)
    form.set("type", "META")
    form.set("value", "30")
    form.set("paymentMethod", "CONSUMO")
    form.set("description", "Bônus de meta batida, pago abatendo o consumo")
    const { status, json } = await api(master, "POST", "/api/company/occurrences", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    const after = await prisma.user.findUniqueOrThrow({ where: { id: pColabA.id } })
    const delta = Number(before.consumptionDebt) - Number(after.consumptionDebt)
    return Math.abs(delta - 30) < 0.01 || `consumptionDebt caiu ${delta}, esperado 30`
  })

  await check("Consumo.Consulta", "GET /api/company/consumption-debt devolve o saldo e o extrato pro próprio colaborador", async () => {
    const { status, json } = await api(A, "GET", "/api/company/consumption-debt")
    if (status !== 200) return `status ${status}`
    if (typeof json.debt !== "number") return "debt ausente"
    return Array.isArray(json.entries) && json.entries.length >= 2 ? true : `entries = ${JSON.stringify(json.entries)}`
  })

  // ===========================================================================
  printSummary("RESULTADO FINAL — CONFIRMAÇÃO DE PONTO, CONSUMO E HORAS EXTRAS")
  await prisma.$disconnect()
  process.exit(results.some((r) => !r.pass) ? 1 : 0)
}

main().catch((e) => {
  console.error("ERRO FATAL NA AUDITORIA:", e)
  process.exit(1)
})
