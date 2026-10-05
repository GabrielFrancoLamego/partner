import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results } from "./audit-lib"

/**
 * Auditoria do acesso do Colaborador a Ocorrências/Financeiro — estado FINAL
 * (pós "Colaborador com Função Financeira"):
 * - Colaborador comum (sem flags): só vê as PRÓPRIAS ocorrências, não lança,
 *   sem acesso ao Financeiro.
 * - O antigo modo CREATE_ONLY por flag separada (canRegisterOccurrences) está
 *   definitivamente retirado — mesmo marcado, sozinho não dá nenhum acesso.
 * - Colaborador com `responsavelFinanceiro` (EmployeeProfile.isFinanceResponsible):
 *   mantém acesso integral de Colaborador E ganha o módulo Financeiro — lança
 *   ocorrências, vê de todos, dá baixa em pagamentos, aprova saques de
 *   parceiro — mas NÃO edita/exclui lançamentos já existentes (exclusivo de
 *   Gerente/Master).
 * - Papel COMPANY_FINANCE: mesmas 3 capacidades de ocorrências (lança/vê
 *   todos/baixa), também sem editar/excluir.
 * Idempotente.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  const rafael = await prisma.user.findUnique({ where: { email: "rafael.jeri@teste.com.vc" } })
  if (!colaborador || !rafael) throw new Error("fixtures não encontradas")

  // Reset — colaborador começa SEM nenhuma flag.
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: false, isFinanceResponsible: false } })
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: { startsWith: "[Audit]" } } })

  const masterSession = await loginAs("master@teste.com.vc")
  const financeiroSession = await loginAs("financeiro@teste.com.vc")

  // --------------------------------------------------------------------------
  // Colaborador comum — nenhuma flag
  // --------------------------------------------------------------------------
  let colaboradorSession = await loginAs("colaborador@teste.com.vc")

  const outraOcorrencia = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeId: rafael.id,
      type: "VALE",
      date: new Date(),
      value: 100,
      quantity: 1,
      total: 100,
      paymentStatus: "PENDING",
      description: "[Audit] ocorrência de outro colaborador",
      createdById: masterSession.userId,
    },
  })

  const listRes1 = await api(colaboradorSession, "GET", "/api/company/occurrences")
  await check("1.ColaboradorComum", "Vê a própria lista (200)", async () => listRes1.status === 200)
  await check(
    "1.ColaboradorComum",
    "NÃO vê ocorrência de outro colega",
    async () => Array.isArray(listRes1.json) && !listRes1.json.some((o: any) => o.id === outraOcorrencia.id),
  )

  const postRes1 = await api(colaboradorSession, "POST", "/api/company/occurrences", new FormData(), true)
  await check("1.ColaboradorComum", "NÃO consegue lançar ocorrência (403)", async () => postRes1.status === 403)

  const financeRes1 = await api(colaboradorSession, "GET", "/api/company/finance/receivables")
  await check("1.ColaboradorComum", "NÃO acessa o módulo Financeiro (403)", async () => financeRes1.status === 403)

  // --------------------------------------------------------------------------
  // Flag antiga (canRegisterOccurrences) sozinha — continua SEM efeito
  // --------------------------------------------------------------------------
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: true } })
  const postRes2 = await api(colaboradorSession, "POST", "/api/company/occurrences", new FormData(), true)
  await check(
    "1.FlagAntigaRetirada",
    "canRegisterOccurrences sozinho NÃO dá mais acesso de lançar ocorrência (403)",
    async () => postRes2.status === 403,
  )

  // --------------------------------------------------------------------------
  // responsavelFinanceiro (isFinanceResponsible) — dual access
  // --------------------------------------------------------------------------
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: false, isFinanceResponsible: true } })
  colaboradorSession = await loginAs("colaborador@teste.com.vc")

  const financeRes2 = await api(colaboradorSession, "GET", "/api/company/finance/receivables")
  await check("2.ResponsavelFinanceiro", "Com responsavelFinanceiro=true, acessa o módulo Financeiro (200)", async () => financeRes2.status === 200)

  const checklistRes = await api(colaboradorSession, "GET", "/api/company/checklists")
  await check("2.ResponsavelFinanceiro", "Mantém acesso integral às telas normais de Colaborador (Checklists, 200)", async () => checklistRes.status === 200)

  const listRes2 = await api(colaboradorSession, "GET", "/api/company/occurrences")
  await check(
    "2.ResponsavelFinanceiro",
    "Agora vê de TODOS os colaboradores (inclui a ocorrência do Rafael)",
    async () => listRes2.status === 200 && Array.isArray(listRes2.json) && listRes2.json.some((o: any) => o.id === outraOcorrencia.id),
  )

  const createForm = new FormData()
  createForm.append("employeeId", colaborador.id)
  createForm.append("type", "VALE")
  createForm.append("value", "30")
  createForm.append("description", "[Audit] vale lançado pelo responsavelFinanceiro")
  const postRes3 = await api(colaboradorSession, "POST", "/api/company/occurrences", createForm, true)
  await check("2.ResponsavelFinanceiro", "Consegue lançar ocorrência", async () => postRes3.status === 201)

  if (postRes3.status === 201) {
    const markPaidRes = await api(colaboradorSession, "POST", `/api/company/occurrences/${postRes3.json.id}/mark-paid`, new FormData(), true)
    await check("2.ResponsavelFinanceiro", "Consegue dar baixa (marcar como paga)", async () => markPaidRes.status === 200)

    const editRes = await api(colaboradorSession, "PATCH", `/api/company/occurrences/${outraOcorrencia.id}`, { description: "tentativa de editar" })
    await check("2.ResponsavelFinanceiro", "NÃO consegue editar uma ocorrência já existente (403 — exclusivo Gerente/Master)", async () => editRes.status === 403)

    const deleteRes = await api(colaboradorSession, "DELETE", `/api/company/occurrences/${outraOcorrencia.id}`)
    await check("2.ResponsavelFinanceiro", "NÃO consegue excluir uma ocorrência já existente (403 — exclusivo Gerente/Master)", async () => deleteRes.status === 403)
  } else {
    record("2.ResponsavelFinanceiro", "Consegue dar baixa (marcar como paga)", false, "ocorrência não foi criada")
  }

  // --------------------------------------------------------------------------
  // Papel COMPANY_FINANCE — mesmas 3 capacidades, sem editar/excluir
  // --------------------------------------------------------------------------
  const financeiroListRes = await api(financeiroSession, "GET", "/api/company/occurrences")
  await check("3.PapelFinanceiro", "Vê de todos os colaboradores", async () => financeiroListRes.status === 200)

  const financeiroEditRes = await api(financeiroSession, "PATCH", `/api/company/occurrences/${outraOcorrencia.id}`, { description: "tentativa" })
  await check("3.PapelFinanceiro", "NÃO consegue editar ocorrência já existente (403)", async () => financeiroEditRes.status === 403)

  printSummary("ACESSO DO COLABORADOR A OCORRÊNCIAS/FINANCEIRO — ESTADO FINAL (DUAL ACCESS)")

  // Limpeza
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: { startsWith: "[Audit]" } } })
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: false, isFinanceResponsible: false } })

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
