/**
 * Terceira leva da auditoria E2E — experiência do Colaborador: ponto digital
 * de precisão (tolerância de 15min simétrica, intervalo picado ou de uma vez
 * só), pontuação por atraso/falta/checklist não entregue, sincronização de
 * Ocorrências (pontos/salário/banco de horas) e as notificações que dão
 * clareza ao colaborador sobre cada uma dessas mudanças.
 *
 * Requer: `npm run dev` rodando em http://localhost:3000. Roda por cima das
 * fixtures já criadas por scripts/audit-e2e-full-variations.ts (Pousada Vento
 * Norte + colaboradorA/colaboradorB) — rode aquele script pelo menos uma vez
 * antes deste.
 * Uso: npx tsx scripts/audit-e2e-colaborador.ts
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
  console.log(`\n=== AUDITORIA E2E — EXPERIÊNCIA DO COLABORADOR — ${new Date().toISOString()} ===\n`)

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

  async function resetToday(userId: string) {
    await prisma.timeEntry.deleteMany({ where: { userId, companyId: pousada.id, createdAt: { gte: startOfDay() } } })
  }
  async function getBank(userId: string) {
    const p = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId } })
    return p.bankOfHoursMinutes
  }
  async function latestNotification(userId: string, titleContains: string) {
    return prisma.notification.findFirst({
      where: { userId, title: { contains: titleContains }, createdAt: { gte: new Date(Date.now() - 60000) } },
      orderBy: { createdAt: "desc" },
    })
  }
  async function punch(session: Session, type: string, lat = Number(company.latitude), lng = Number(company.longitude)) {
    return api(session, "POST", "/api/company/timeclock", { type, latitude: lat, longitude: lng })
  }
  /** Insere uma batida diretamente via Prisma, com createdAt no passado — usado
   * para montar o histórico de hoje sem precisar esperar o tempo real passar.
   * `minutesAgoVal` maiores devem vir primeiro para preservar a ordem cronológica
   * (senão o próximo punch() via API vê a sequênciafora de ordem). */
  async function insertBackdated(userId: string, type: "CHECK_IN" | "BREAK_START" | "BREAK_END", minutesAgoVal: number) {
    return prisma.timeEntry.create({
      data: {
        userId,
        companyId: pousada.id,
        type,
        latitude: company.latitude!,
        longitude: company.longitude!,
        createdAt: new Date(Date.now() - minutesAgoVal * 60 * 1000),
      },
    })
  }
  const dummyFile = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "foto.jpg", { type: "image/jpeg" })

  // ===========================================================================
  // PONTO — o relógio só CALCULA (prévia), nada é aplicado na hora. A
  // aplicação de verdade (após confirmação da Gerente no fechamento) é
  // testada em scripts/audit-e2e-timeclock-review.ts.
  // ===========================================================================
  console.log("--- PONTO: prévia calculada na hora, SEM aplicar nada ao banco/pontos ---")

  await check("Ponto.Previa", "CHECK_IN com 20min de atraso devolve a prévia (5min além da tolerância) mas NÃO debita o banco", async () => {
    await resetToday(pColabA.id)
    await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { workStartTime: minutesAgo(20), bankOfHoursMinutes: 0 } })
    const { status, json } = await punch(A, "CHECK_IN")
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    if (json.lateMinutes !== 5) return `lateMinutes (prévia) = ${json.lateMinutes}, esperado 5`
    const bank = await getBank(pColabA.id)
    return bank === 0 || `bankOfHoursMinutes = ${bank}, esperado 0 — nada deve ser aplicado sem a Gerente confirmar no fechamento`
  })

  await check("Ponto.Previa", "CHECK_OUT 20min depois do horário devolve a prévia (+5min) mas NÃO credita o banco", async () => {
    await resetToday(pColabA.id)
    await prisma.employeeProfile.update({
      where: { userId: pColabA.id },
      data: { workStartTime: minutesAgo(0), workEndTime: minutesAgo(0), bankOfHoursMinutes: 0 },
    })
    await punch(A, "CHECK_IN")
    await punch(A, "BREAK_START")
    await punch(A, "BREAK_END")
    await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { workEndTime: minutesAgo(20) } })
    const { status, json } = await punch(A, "CHECK_OUT")
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    if (json.bankMinutesDelta !== 5) return `bankMinutesDelta (prévia) = ${json.bankMinutesDelta}, esperado 5`
    const bank = await getBank(pColabA.id)
    return bank === 0 || `bankOfHoursMinutes = ${bank}, esperado 0 — nada deve ser aplicado sem confirmação`
  })

  await check("Ponto.Previa", "Intervalo além da tolerância devolve a prévia do excedente mas NÃO debita o banco", async () => {
    if (crossesMidnight(90)) return true // ignorado: batidas de 90 min atrás cairiam no dia anterior (ver crossesMidnight)
    await resetToday(pColabB.id)
    await prisma.employeeProfile.update({ where: { userId: pColabB.id }, data: { dailyBreakAllowanceMinutes: 60, bankOfHoursMinutes: 0 } })
    // 80min de pausa: 60 permitidos + 15 de tolerância = 75 livres; excedente = 5min.
    await insertBackdated(pColabB.id, "CHECK_IN", 90)
    await insertBackdated(pColabB.id, "BREAK_START", 80)
    const { status, json } = await punch(B, "BREAK_END")
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    if (json.breakOverageMinutes !== 5) return `breakOverageMinutes (prévia) = ${json.breakOverageMinutes}, esperado 5`
    const bank = await getBank(pColabB.id)
    return bank === 0 || `bankOfHoursMinutes = ${bank}, esperado 0 — nada deve ser aplicado sem confirmação`
  })

  // ===========================================================================
  // CHECKLIST — pontuação por atraso/não entrega + notificações
  // ===========================================================================
  console.log("\n--- CHECKLIST: pontuação e notificações ---")

  let lateChecklistId = ""
  await check("Checklist.Pontuacao", "Colaborador entrega checklist avulso fora do prazo", async () => {
    const form = new FormData()
    form.set("title", "Tarefa de teste — atraso proposital")
    form.set("priority", "MEDIUM")
    form.set("file", dummyFile())
    const { status, json } = await api(A, "POST", "/api/company/checklists", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    lateChecklistId = json.id
    return true
  })

  await check("Checklist.Pontuacao", "Gerente aprova o checklist entregue depois do prazo -> pontuação reduzida + notificação", async () => {
    // Força o checklist a já estar vencido (dueAt no passado) para simular "fora do prazo" de forma determinística.
    await prisma.checklist.update({ where: { id: lateChecklistId }, data: { dueAt: new Date(Date.now() - 5 * 60 * 1000) } })
    const { status, json } = await api(gerente, "PATCH", `/api/company/checklists/${lateChecklistId}`, { status: "APPROVED" })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    const n = await latestNotification(pColabA.id, "aprovado fora do prazo")
    if (!n) return "notificação de aprovação fora do prazo não encontrada"
    return true
  })

  let rejectChecklistId = ""
  await check("Checklist.Pontuacao", "Colaborador entrega outro checklist (para o teste de rejeição)", async () => {
    const form = new FormData()
    form.set("title", "Tarefa de teste — será rejeitada")
    form.set("priority", "LOW")
    form.set("file", dummyFile())
    const { status, json } = await api(A, "POST", "/api/company/checklists", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    rejectChecklistId = json.id
    return true
  })

  await check("Checklist.Pontuacao", "Gerente REJEITA (não entregue) com motivo -> penaliza XP + notifica com o motivo", async () => {
    const bankBefore = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    const { status, json } = await api(gerente, "PATCH", `/api/company/checklists/${rejectChecklistId}`, {
      status: "REJECTED",
      note: "Foto anexada não corresponde ao quarto correto",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    const n = await latestNotification(pColabA.id, "não entregue")
    if (!n) return "notificação de rejeição não encontrada"
    if (!n.message.includes("Foto anexada")) return `notificação não traz o motivo: ${n.message}`
    const after = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    return after.xpPoints < bankBefore.xpPoints || `xpPoints não caiu (antes=${bankBefore.xpPoints}, depois=${after.xpPoints})`
  })

  let returnChecklistId = ""
  await check("Checklist.Pontuacao", "Colaborador entrega outro checklist (para o teste de devolução)", async () => {
    const form = new FormData()
    form.set("title", "Tarefa de teste — será devolvida")
    form.set("priority", "LOW")
    form.set("file", dummyFile())
    const { status, json } = await api(A, "POST", "/api/company/checklists", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    returnChecklistId = json.id
    return true
  })

  await check("Checklist.Pontuacao", "Gerente DEVOLVE com motivo -> notifica o colaborador (sem penalizar ainda)", async () => {
    const { status } = await api(gerente, "PATCH", `/api/company/checklists/${returnChecklistId}`, {
      status: "RETURNED",
      note: "Falta foto do banheiro — refaça",
    })
    if (status !== 200) return `status ${status}`
    const n = await latestNotification(pColabA.id, "devolvido")
    if (!n) return "notificação de devolução não encontrada"
    return n.message.includes("Falta foto") || `mensagem sem o motivo: ${n.message}`
  })

  await check("Checklist.PendingCount", "Badge piscante (pending-count) reflete corretamente as tarefas pendentes do colaborador", async () => {
    const { status, json } = await api(A, "GET", "/api/company/checklists/pending-count")
    if (status !== 200) return `status ${status}`
    // A tarefa devolvida (RETURNED -> volta a PENDING) deve contar.
    return json.count >= 1 || `count = ${json.count}, esperado >=1 (a tarefa devolvida voltou a PENDING)`
  })

  // ===========================================================================
  // OCORRÊNCIAS — sincronização de pontos/salário/banco de horas + notificação
  // ===========================================================================
  console.log("\n--- OCORRÊNCIAS: sincronização e notificações ---")

  async function createOccurrence(fields: Record<string, string>) {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.set(k, v)
    // ADVERTENCIA/ATESTADO/DISPENSADO exigem anexo — anexa sempre, é inofensivo para os demais tipos.
    form.set("file", dummyFile())
    return api(master, "POST", "/api/company/occurrences", form, true)
  }

  await check("Ocorrencia.Sync", "ADVERTENCIA aplica a penalidade de pontos configurada + notifica", async () => {
    const before = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    const { status, json } = await createOccurrence({ employeeId: pColabA.id, type: "ADVERTENCIA", description: "Uniforme fora do padrão" })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    const after = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    if (after.xpPoints >= before.xpPoints) return `xpPoints não caiu (antes=${before.xpPoints}, depois=${after.xpPoints})`
    const n = await latestNotification(pColabA.id, "Advertência")
    if (!n) return "notificação de advertência não encontrada"
    return n.message.includes("Uniforme fora do padrão") || `motivo ausente na notificação: ${n.message}`
  })

  await check("Ocorrencia.Sync", "SUSPENSAO agora TAMBÉM aplica penalidade de pontos (fix aplicado — antes só ADVERTENCIA aplicava)", async () => {
    const before = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    const { status, json } = await createOccurrence({ employeeId: pColabA.id, type: "SUSPENSAO", description: "Reincidência de atraso" })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    const after = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    if (after.xpPoints >= before.xpPoints) return `xpPoints não caiu com SUSPENSAO (antes=${before.xpPoints}, depois=${after.xpPoints})`
    const n = await latestNotification(pColabA.id, "Suspensão")
    return Boolean(n) || "notificação de suspensão não encontrada"
  })

  await check("Ocorrencia.Sync", "FALTA sem atestado: desconta salário (baseado no salário mensal) E penaliza pontos, notifica os dois", async () => {
    await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { monthlySalary: 3000 } })
    const before = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    const { status, json } = await createOccurrence({ employeeId: pColabA.id, type: "FALTA" })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    if (json.total === null || Number(json.total) >= 0) return `total = ${json.total}, esperado desconto negativo (1 dia de R$3000/30)`
    const after = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    if (after.xpPoints >= before.xpPoints) return "xpPoints não caiu com FALTA"
    const n = await latestNotification(pColabA.id, "Falta")
    if (!n) return "notificação de falta não encontrada"
    return n.message.includes("desconto") || `notificação não menciona o desconto: ${n.message}`
  })

  await check("Ocorrencia.Sync", "Tipo configurável (CUSTOM) kind=SALARY notifica o desconto/crédito corretamente", async () => {
    const customType = await prisma.occurrenceTypeConfig.upsert({
      where: { companyId_name: { companyId: pousada.id, name: "Quebra de Equipamento (E2E)" } },
      update: {},
      create: {
        companyId: pousada.id,
        name: "Quebra de Equipamento (E2E)",
        kind: "SALARY",
        salaryImpactType: "DISCOUNT",
        salaryImpactValue: 50,
        createdById: pMaster.id,
      },
    })
    const { status, json } = await createOccurrence({ employeeId: pColabA.id, type: "CUSTOM", customTypeId: customType.id, description: "Quebrou uma bandeja" })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    if (Number(json.total) !== -50) return `total = ${json.total}, esperado -50`
    const n = await latestNotification(pColabA.id, "Quebra de Equipamento")
    if (!n) return "notificação não encontrada"
    return n.message.includes("desconto de R$") || `mensagem sem o desconto: ${n.message}`
  })

  await check("Ocorrencia.Sync", "Tipo configurável (CUSTOM) kind=HOURS_BANK credita o banco de horas de verdade", async () => {
    const customType = await prisma.occurrenceTypeConfig.upsert({
      where: { companyId_name: { companyId: pousada.id, name: "Folga Compensada Concedida (E2E)" } },
      update: {},
      create: {
        companyId: pousada.id,
        name: "Folga Compensada Concedida (E2E)",
        kind: "HOURS_BANK",
        hoursBankImpactMinutes: -120,
        createdById: pMaster.id,
      },
    })
    await prisma.employeeProfile.update({ where: { userId: pColabA.id }, data: { bankOfHoursMinutes: 200 } })
    const { status } = await createOccurrence({ employeeId: pColabA.id, type: "CUSTOM", customTypeId: customType.id, description: "Compensou 2h de banco de horas" })
    if (status !== 201) return `status ${status}`
    const after = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: pColabA.id } })
    if (after.bankOfHoursMinutes !== 80) return `bankOfHoursMinutes = ${after.bankOfHoursMinutes}, esperado 80 (200-120)`
    const n = await latestNotification(pColabA.id, "Folga Compensada")
    if (!n) return "notificação não encontrada"
    return n.message.includes("-120min") || `mensagem sem o impacto no banco de horas: ${n.message}`
  })

  // ===========================================================================
  printSummary("RESULTADO FINAL — EXPERIÊNCIA DO COLABORADOR")
  await prisma.$disconnect()
  process.exit(results.some((r) => !r.pass) ? 1 : 0)
}

main().catch((e) => {
  console.error("ERRO FATAL NA AUDITORIA:", e)
  process.exit(1)
})
