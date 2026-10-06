import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results } from "./audit-lib"

/**
 * Auditoria do Módulo Financeiro Operacional (Contas a Pagar, Ordem de
 * Pagamento, Relatórios) e da Folha de Pagamento (Master/Gerente) — seções
 * 2, 3 e 5 do pedido "Colaborador com Função Financeira". Idempotente.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  if (!colaborador) throw new Error("colaborador não encontrado")

  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: { startsWith: "[Audit]" } } })

  const masterSession = await loginAs("master@teste.com.vc")
  const gerenteSession = await loginAs("gerente@teste.com.vc")
  const financeiroSession = await loginAs("financeiro@teste.com.vc")
  const colaboradorSession = await loginAs("colaborador@teste.com.vc")

  // --------------------------------------------------------------------------
  // SEÇÃO 2 — Contas a Pagar / Ordem de Pagamento
  // --------------------------------------------------------------------------
  const valeRes = await api(masterSession, "POST", "/api/company/occurrences", (() => {
    const f = new FormData()
    f.append("employeeId", colaborador.id)
    f.append("type", "VALE")
    f.append("value", "75")
    f.append("description", "[Audit] vale pendente pra contas a pagar")
    return f
  })(), true)
  await check("2.ContasAPagar", "Setup: Master cria um VALE pendente", async () => valeRes.status === 201)

  const payablesRes = await api(financeiroSession, "GET", "/api/company/finance/payables")
  await check("2.ContasAPagar", "Financeiro vê Contas a Pagar (200)", async () => payablesRes.status === 200)
  await check(
    "2.ContasAPagar",
    "Lista inclui o VALE recém-criado, com dueDate e recipientName",
    async () =>
      Array.isArray(payablesRes.json) &&
      payablesRes.json.some((r: any) => r.id === valeRes.json?.id && r.recipientName === colaborador.name && Boolean(r.dueDate)),
  )

  const colaboradorPayablesRes = await api(colaboradorSession, "GET", "/api/company/finance/payables")
  await check("2.ContasAPagar", "Colaborador comum NÃO acessa Contas a Pagar (403)", async () => colaboradorPayablesRes.status === 403)

  const paymentOrderRes = await api(financeiroSession, "GET", "/api/company/finance/payment-order")
  await check("2.OrdemPagamento", "Financeiro vê a Ordem de Pagamento (200)", async () => paymentOrderRes.status === 200)
  await check(
    "2.OrdemPagamento",
    "Linha do colaborador consolida o valor pendente com os dados bancários/reasons",
    async () => {
      const row = Array.isArray(paymentOrderRes.json) ? paymentOrderRes.json.find((r: any) => r.recipientId === colaborador.id) : null
      if (Boolean(row) && row.totalAmount >= 75 && Array.isArray(row.reasons) && row.reasons.length > 0) return true
      return `row=${JSON.stringify(row)} totalRows=${Array.isArray(paymentOrderRes.json) ? paymentOrderRes.json.length : typeof paymentOrderRes.json} valeId=${valeRes.json?.id}`
    },
  )

  // --------------------------------------------------------------------------
  // SEÇÃO 4 — Financeiro lança, mas não edita/exclui (reforço com o ID real)
  // --------------------------------------------------------------------------
  const financeiroEditRes = await api(financeiroSession, "PATCH", `/api/company/occurrences/${valeRes.json.id}`, { description: "tentativa" })
  await check("4.Trava", "Financeiro NÃO edita uma ocorrência já cadastrada (403)", async () => financeiroEditRes.status === 403)
  const financeiroDeleteRes = await api(financeiroSession, "DELETE", `/api/company/occurrences/${valeRes.json.id}`)
  await check("4.Trava", "Financeiro NÃO exclui uma ocorrência já cadastrada (403)", async () => financeiroDeleteRes.status === 403)
  const masterEditRes = await api(masterSession, "PATCH", `/api/company/occurrences/${valeRes.json.id}`, { description: "[Audit] vale pendente pra contas a pagar (editado pelo Master)" })
  await check("4.Trava", "Master CONSEGUE editar normalmente", async () => masterEditRes.status === 200)

  // --------------------------------------------------------------------------
  // SEÇÃO 3 — Relatórios Financeiros
  // --------------------------------------------------------------------------
  const withdrawalsReportRes = await api(masterSession, "GET", "/api/company/finance/reports?type=withdrawals&period=month")
  await check(
    "3.Relatorios",
    "Relatório de Saques (Realizados vs Pendentes) responde com os 4 agregados",
    async () =>
      withdrawalsReportRes.status === 200 &&
      ["paid", "pending", "approved", "rejected"].every((k) => typeof withdrawalsReportRes.json?.[k]?.total === "number"),
  )

  const walletsReportRes = await api(masterSession, "GET", "/api/company/finance/reports?type=wallets")
  await check(
    "3.Relatorios",
    "Relatório de Carteiras devolve parceiros e colaboradores",
    async () => walletsReportRes.status === 200 && Array.isArray(walletsReportRes.json?.partners) && Array.isArray(walletsReportRes.json?.employees),
  )

  const roiReportRes = await api(masterSession, "GET", "/api/company/finance/reports?type=roi&period=month")
  await check(
    "3.Relatorios",
    "Relatório de ROI por Indicações calcula faturamento vs custo de comissão",
    async () => roiReportRes.status === 200 && typeof roiReportRes.json?.totalRevenueGenerated === "number" && typeof roiReportRes.json?.totalCommissionCost === "number",
  )

  const gerenteReportsRes = await api(gerenteSession, "GET", "/api/company/finance/reports?type=withdrawals")
  await check("3.Relatorios", "Gerente também acessa Relatórios (canManageDailyOperations)", async () => gerenteReportsRes.status === 200)

  const colaboradorReportsRes = await api(colaboradorSession, "GET", "/api/company/finance/reports?type=withdrawals")
  await check("3.Relatorios", "Colaborador comum NÃO acessa Relatórios (403)", async () => colaboradorReportsRes.status === 403)

  // --------------------------------------------------------------------------
  // SEÇÃO 5 — Bônus/Desconto Especial (Master-only) + Folha de Pagamento
  // --------------------------------------------------------------------------
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { monthlySalary: 3000, employmentType: "FIXO" } })

  const bonusForm = new FormData()
  bonusForm.append("employeeId", colaborador.id)
  bonusForm.append("type", "BONUS_ESPECIAL")
  bonusForm.append("value", "200")
  bonusForm.append("description", "[Audit] bônus especial do Master")
  const gerenteBonusRes = await api(gerenteSession, "POST", "/api/company/occurrences", bonusForm, true)
  await check("5.BonusDesconto", "Gerente NÃO consegue lançar Bônus Especial (403 — exclusivo do Master)", async () => gerenteBonusRes.status === 403)

  const masterBonusRes = await api(masterSession, "POST", "/api/company/occurrences", bonusForm, true)
  await check("5.BonusDesconto", "Master consegue lançar Bônus Especial", async () => masterBonusRes.status === 201)
  await check("5.BonusDesconto", "Valor do Bônus Especial é sempre positivo", async () => Number(masterBonusRes.json?.total) === 200)

  const descontoForm = new FormData()
  descontoForm.append("employeeId", colaborador.id)
  descontoForm.append("type", "DESCONTO_ESPECIAL")
  descontoForm.append("value", "50")
  descontoForm.append("description", "[Audit] desconto especial do Master")
  const masterDescontoRes = await api(masterSession, "POST", "/api/company/occurrences", descontoForm, true)
  await check("5.BonusDesconto", "Master consegue lançar Desconto Especial", async () => masterDescontoRes.status === 201)
  await check("5.BonusDesconto", "Valor do Desconto Especial é sempre negativo", async () => Number(masterDescontoRes.json?.total) === -50)

  const advanceRes = await api(masterSession, "GET", "/api/company/payroll?phase=ADVANCE")
  await check("5.Folha", "Folha de Adiantamento (dia 20) responde 200", async () => advanceRes.status === 200)
  const advanceRow = advanceRes.json?.rows?.find((r: any) => r.employeeId === colaborador.id)
  await check(
    "5.Folha",
    "Adiantamento calcula 40% do salário fixo (R$ 3000 -> R$ 1200)",
    async () => Boolean(advanceRow) && Math.abs(advanceRow.proventos.adiantamento - 1200) < 0.01,
  )

  const balanceRes = await api(masterSession, "GET", "/api/company/payroll?phase=BALANCE")
  await check("5.Folha", "Folha Principal (5º dia útil) responde 200", async () => balanceRes.status === 200)
  const balanceRow = balanceRes.json?.rows?.find((r: any) => r.employeeId === colaborador.id)
  await check(
    "5.Folha",
    "Folha Principal calcula o saldo 60% (R$ 1800) com dados bancários presentes",
    async () => Boolean(balanceRow) && Math.abs(balanceRow.proventos.saldoSalario - 1800) < 0.01 && "bankName" in balanceRow,
  )
  await check(
    "5.Folha",
    "Folha Principal inclui o Bônus Especial lançado pelo Master",
    async () => Boolean(balanceRow) && balanceRow.proventos.bonusEspecial >= 200,
  )
  await check(
    "5.Folha",
    "Folha Principal inclui o Desconto Especial lançado pelo Master",
    async () => Boolean(balanceRow) && balanceRow.descontos.descontoEspecial >= 50,
  )

  const financeiroPayrollRes = await api(financeiroSession, "GET", "/api/company/payroll?phase=ADVANCE")
  await check("5.Folha", "Financeiro (sem canManageDailyOperations) NÃO acessa a Folha de Pagamento (403)", async () => financeiroPayrollRes.status === 403)

  const gerentePayrollRes = await api(gerenteSession, "GET", "/api/company/payroll?phase=ADVANCE")
  await check("5.Folha", "Gerente acessa a Folha de Pagamento normalmente", async () => gerentePayrollRes.status === 200)

  printSummary("MÓDULO FINANCEIRO OPERACIONAL (CONTAS A PAGAR/ORDEM DE PAGAMENTO/RELATÓRIOS) E FOLHA DE PAGAMENTO")

  // Limpeza
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: { startsWith: "[Audit]" } } })

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
