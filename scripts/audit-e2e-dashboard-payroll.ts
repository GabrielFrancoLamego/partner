import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results, startOfDay } from "./audit-lib"

/**
 * Auditoria do ciclo "Dashboard do Colaborador, Header Gamificado, Sua Conta
 * e Regras de Contratação (Diarista/Temporário/Fixo)" — cobre as seções 2-5
 * (a 1, badge no header, é client-only e não dá pra testar via API).
 * Idempotente — pode rodar várias vezes seguidas (reseta os fixtures no início).
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")

  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  const rafael = await prisma.user.findUnique({ where: { email: "rafael.jeri@teste.com.vc" } })
  const ana = await prisma.user.findUnique({ where: { email: "ana.jeri@teste.com.vc" } })
  if (!colaborador || !rafael || !ana) throw new Error("fixtures de colaborador não encontradas")

  // Reset de fixtures (idempotência)
  await prisma.user.updateMany({ where: { id: { in: [rafael.id, ana.id] } }, data: { status: "ACTIVE" } })
  await prisma.employeeProfile.update({
    where: { userId: rafael.id },
    data: { employmentType: "DIARISTA", contractStartDate: null, contractEndDate: null },
  })
  await prisma.employeeProfile.update({
    where: { userId: ana.id },
    data: { employmentType: "TEMPORARIO", contractStartDate: new Date(Date.now() - 30 * 86400000), contractEndDate: null },
  })
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, employeeId: rafael.id, type: "DIARIA" } })

  const masterSession = await loginAs("master@teste.com.vc")
  const gerenteSession = await loginAs("gerente@teste.com.vc")
  const colaboradorSession = await loginAs("colaborador@teste.com.vc")

  // --------------------------------------------------------------------------
  // SEÇÃO 2 — Dashboard: colaborador não vê dados de outros/financeiro de parceiros
  // --------------------------------------------------------------------------
  const empDashRes = await api(colaboradorSession, "GET", "/api/company/dashboard?period=month")
  await check("2.Dashboard", "Colaborador: 'operations' (company-wide) vem null", async () => empDashRes.json?.operations === null)
  await check("2.Dashboard", "Colaborador: 'partners' (financeiro) vem null", async () => empDashRes.json?.partners === null)
  await check("2.Dashboard", "Colaborador: 'myOperations' vem preenchido (resumo próprio)", async () => empDashRes.json?.myOperations !== null)
  await check("2.Dashboard", "Colaborador: 'partnersSimple' vem preenchido (sem financeiro)", async () => empDashRes.json?.partnersSimple !== null)
  await check("2.Dashboard", "Colaborador: 'efficiencySummary' vem com percent numérico", async () => typeof empDashRes.json?.efficiencySummary?.percent === "number")

  const masterDashRes = await api(masterSession, "GET", "/api/company/dashboard?period=month")
  await check("2.Dashboard", "Master: 'operations'/'partners' company-wide continuam preenchidos", async () => masterDashRes.json?.operations !== null && masterDashRes.json?.partners !== null)
  await check("2.Dashboard", "Master: 'myOperations' vem null (Master não é colaborador)", async () => masterDashRes.json?.myOperations === null)

  // --------------------------------------------------------------------------
  // SEÇÃO 3 — "Sua Conta": extrato financeiro detalhado
  // --------------------------------------------------------------------------
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { monthlySalary: 3000, employmentType: "FIXO" } })
  const myAccountRes = await api(colaboradorSession, "GET", "/api/company/my-account")
  await check("3.SuaConta", "GET /api/company/my-account responde 200", async () => myAccountRes.status === 200)
  await check(
    "3.SuaConta",
    "Salário Fixo do ciclo atual foi gerado automaticamente (Adiantamento+Saldo pendentes)",
    async () => myAccountRes.json?.earnings?.salarioFixo?.pending > 0,
  )
  await check("3.SuaConta", "Totais somam 'a receber' > 0 com data prevista", async () => myAccountRes.json?.totals?.totalAReceber > 0 && Boolean(myAccountRes.json?.totals?.proximaDataPrevista))

  const myAccountRes2 = await api(colaboradorSession, "GET", "/api/company/my-account")
  const salarioOccurrencesAfterTwoRuns = await prisma.occurrence.count({ where: { companyId: company.id, employeeId: colaborador.id, type: "SALARIO" } })
  await check(
    "3.SuaConta",
    "Chamar de novo não duplica os lançamentos de Salário (idempotência do payroll-engine)",
    async () => myAccountRes2.status === 200 && salarioOccurrencesAfterTwoRuns === 2,
  )

  // --------------------------------------------------------------------------
  // SEÇÃO 4 — Regras de Vínculo: DIARISTA bloqueado ao pagar a diária
  // --------------------------------------------------------------------------
  const diariaOccurrence = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeId: rafael.id,
      type: "DIARIA",
      date: new Date(),
      value: 150,
      quantity: 1,
      total: 150,
      paymentStatus: "PENDING",
      createdById: masterSession.userId,
    },
  })
  const markDiariaRes = await api(gerenteSession, "POST", `/api/company/occurrences/${diariaOccurrence.id}/mark-paid`, new FormData(), true)
  await check("4.Diarista", "Gerente marca a diária como Paga", async () => markDiariaRes.status === 200)
  const rafaelAfterPayment = await prisma.user.findUniqueOrThrow({ where: { id: rafael.id } })
  await check("4.Diarista", "Acesso do Diarista é bloqueado automaticamente após o pagamento (status=INACTIVE)", async () => rafaelAfterPayment.status === "INACTIVE")

  const rafaelSessionBlocked = await loginAs("rafael.jeri@teste.com.vc")
  const rafaelApiAfterBlock = await api(rafaelSessionBlocked, "GET", "/api/company/dashboard")
  await check("4.Diarista", "Sessão do Diarista bloqueado não acessa mais a API (403 — corta no mesmo instante, não só no próximo login)", async () => rafaelApiAfterBlock.status === 403)

  // Reativação ("convocar para novo turno")
  const reactivateRes = await api(masterSession, "PATCH", `/api/company/employees/${rafael.id}`, { status: "ACTIVE" })
  await check("4.Diarista", "Master reativa o Diarista (convocação para novo turno)", async () => reactivateRes.status === 200)
  const rafaelAfterReactivate = await prisma.user.findUniqueOrThrow({ where: { id: rafael.id } })
  await check("4.Diarista", "Status voltou a ACTIVE após reativação", async () => rafaelAfterReactivate.status === "ACTIVE")

  // --------------------------------------------------------------------------
  // SEÇÃO 4 — Regras de Vínculo: TEMPORARIO bloqueado ao vencer sem pendências
  // --------------------------------------------------------------------------
  await prisma.employeeProfile.update({ where: { userId: ana.id }, data: { contractEndDate: new Date(Date.now() - 2 * 86400000) } })
  // Garante que não há nenhuma pendência financeira da Ana que impediria o bloqueio automático.
  await prisma.occurrence.updateMany({ where: { companyId: company.id, employeeId: ana.id, paymentStatus: "PENDING" }, data: { paymentStatus: "PAID" } })
  await prisma.goalPayout.updateMany({ where: { companyId: company.id, employeeId: ana.id, status: "PENDING" }, data: { status: "PAID" } })

  const anaSession = await loginAs("ana.jeri@teste.com.vc")
  const anaApiRes = await api(anaSession, "GET", "/api/company/dashboard")
  await check("4.Temporario", "Contrato vencido SEM pendências -> acesso bloqueado automaticamente (403)", async () => anaApiRes.status === 403)
  const anaAfterBlock = await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })
  await check("4.Temporario", "Status da Ana virou INACTIVE", async () => anaAfterBlock.status === "INACTIVE")

  // Reativa e testa o caso COM pendência financeira -> NÃO bloqueia
  await prisma.user.update({ where: { id: ana.id }, data: { status: "ACTIVE" } })
  const anaOccurrence = await prisma.occurrence.create({
    data: { companyId: company.id, employeeId: ana.id, type: "VALE", date: new Date(), value: 50, quantity: 1, total: 50, paymentStatus: "PENDING", createdById: masterSession.userId },
  })
  const anaSession2 = await loginAs("ana.jeri@teste.com.vc")
  const anaApiRes2 = await api(anaSession2, "GET", "/api/company/dashboard")
  await check("4.Temporario", "Contrato vencido COM pendência financeira -> acesso NÃO é bloqueado", async () => anaApiRes2.status === 200)
  const anaAfterPendingCheck = await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })
  await check("4.Temporario", "Status da Ana permanece ACTIVE enquanto houver pendência", async () => anaAfterPendingCheck.status === "ACTIVE")
  await prisma.occurrence.delete({ where: { id: anaOccurrence.id } })

  // --------------------------------------------------------------------------
  // SEÇÃO 5 — Financeiro: reagendar Data Prevista de Pagamento
  // --------------------------------------------------------------------------
  const pendingSalario = await prisma.occurrence.findFirst({ where: { companyId: company.id, employeeId: colaborador.id, type: "SALARIO", paymentStatus: "PENDING" } })
  if (pendingSalario) {
    const newDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    const rescheduleRes = await api(gerenteSession, "PATCH", `/api/company/occurrences/${pendingSalario.id}/mark-paid`, { expectedPaymentDate: newDate })
    await check("5.Financeiro", "Gerente reagenda a Data Prevista de Pagamento do Salário pendente", async () => rescheduleRes.status === 200)
    const reloaded = await prisma.occurrence.findUniqueOrThrow({ where: { id: pendingSalario.id } })
    await check(
      "5.Financeiro",
      "Nova data prevista foi persistida",
      async () => reloaded.expectedPaymentDate !== null && startOfDay(reloaded.expectedPaymentDate).getTime() === startOfDay(new Date(newDate)).getTime(),
    )
  } else {
    record("5.Financeiro", "Gerente reagenda a Data Prevista de Pagamento do Salário pendente", false, "nenhum SALARIO pendente encontrado para testar")
  }

  printSummary("DASHBOARD DO COLABORADOR, SUA CONTA E REGRAS DE VÍNCULO (DIARISTA/TEMPORARIO/FIXO)")

  // --------------------------------------------------------------------------
  // Limpeza / reset final dos fixtures
  // --------------------------------------------------------------------------
  await prisma.user.updateMany({ where: { id: { in: [rafael.id, ana.id] } }, data: { status: "ACTIVE" } })
  await prisma.employeeProfile.update({ where: { userId: rafael.id }, data: { employmentType: "FIXO" } })
  await prisma.employeeProfile.update({ where: { userId: ana.id }, data: { employmentType: "FIXO", contractStartDate: null, contractEndDate: null } })
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, employeeId: rafael.id, type: "DIARIA" } })
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, employeeId: colaborador.id, type: "SALARIO" } })

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
