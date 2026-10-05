import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results } from "./audit-lib"

/**
 * Auditoria do acesso do Colaborador comum a Financeiro/Ocorrências — cobre
 * o pedido: (1) menu Financeiro retirado do Colaborador (mesmo delegado via
 * isFinanceResponsible); (2) Ocorrências do Colaborador só mostram as
 * próprias, sem lançar nem ver de outros; (3) só o papel Financeiro
 * (COMPANY_FINANCE) lança/vê de todos/dá baixa em ocorrências — sem precisar
 * do flag canRegisterOccurrences, que foi retirado. Idempotente.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  const rafael = await prisma.user.findUnique({ where: { email: "rafael.jeri@teste.com.vc" } })
  if (!colaborador || !rafael) throw new Error("fixtures não encontradas")

  // Reset — flags antigas (canRegisterOccurrences/isFinanceResponsible) não devem mais ter efeito, mas deixamos ligadas de propósito pra provar isso.
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: true, isFinanceResponsible: true } })
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: "[Audit] ocorrência de outro colaborador" } })

  const masterSession = await loginAs("master@teste.com.vc")
  const financeiroSession = await loginAs("financeiro@teste.com.vc")
  const colaboradorSession = await loginAs("colaborador@teste.com.vc")

  // --------------------------------------------------------------------------
  // Financeiro retirado do Colaborador (mesmo com isFinanceResponsible=true)
  // --------------------------------------------------------------------------
  const financeModuleRes = await api(colaboradorSession, "GET", "/api/company/finance/receivables")
  await check(
    "1.Financeiro",
    "Colaborador com isFinanceResponsible=true NÃO acessa mais /finance/receivables (403)",
    async () => financeModuleRes.status === 403,
  )

  // --------------------------------------------------------------------------
  // Ocorrências — Colaborador: só vê as próprias, não lança, não vê de outros
  // --------------------------------------------------------------------------
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

  const colaboradorListRes = await api(colaboradorSession, "GET", "/api/company/occurrences")
  await check("3.Ocorrencias", "Colaborador consegue ver a lista (200, não 403)", async () => colaboradorListRes.status === 200)
  await check(
    "3.Ocorrencias",
    "Lista do Colaborador NÃO inclui a ocorrência de outro colega",
    async () => Array.isArray(colaboradorListRes.json) && !colaboradorListRes.json.some((o: any) => o.id === outraOcorrencia.id),
  )
  await check(
    "3.Ocorrencias",
    "Toda ocorrência retornada pertence só ao próprio Colaborador",
    async () => Array.isArray(colaboradorListRes.json) && colaboradorListRes.json.every((o: any) => o.employee?.id === colaborador.id),
  )

  // Tenta passar employeeId de outro colaborador via query string — deve ser ignorado/forçado ao próprio id.
  const colaboradorTryOthersRes = await api(colaboradorSession, "GET", `/api/company/occurrences?employeeId=${rafael.id}`)
  await check(
    "3.Ocorrencias",
    "Colaborador NÃO consegue forçar employeeId de outro colega via query string",
    async () => Array.isArray(colaboradorTryOthersRes.json) && !colaboradorTryOthersRes.json.some((o: any) => o.id === outraOcorrencia.id),
  )

  const colaboradorPostRes = await api(colaboradorSession, "POST", "/api/company/occurrences", new FormData(), true)
  await check(
    "3.Ocorrencias",
    "Colaborador NÃO consegue lançar ocorrência mesmo com canRegisterOccurrences=true (403 — flag retirada)",
    async () => colaboradorPostRes.status === 403,
  )

  // --------------------------------------------------------------------------
  // Ocorrências — Financeiro: lança, vê de todos, dá baixa
  // --------------------------------------------------------------------------
  const financeiroListRes = await api(financeiroSession, "GET", "/api/company/occurrences")
  await check(
    "3.Ocorrencias",
    "Financeiro vê de todos os colaboradores (inclui a ocorrência criada pro Rafael)",
    async () => financeiroListRes.status === 200 && Array.isArray(financeiroListRes.json) && financeiroListRes.json.some((o: any) => o.id === outraOcorrencia.id),
  )

  const financeiroCreateForm = new FormData()
  financeiroCreateForm.append("employeeId", colaborador.id)
  financeiroCreateForm.append("type", "VALE")
  financeiroCreateForm.append("value", "50")
  financeiroCreateForm.append("description", "[Audit] vale lançado pelo financeiro")
  const financeiroPostRes = await api(financeiroSession, "POST", "/api/company/occurrences", financeiroCreateForm, true)
  await check("3.Ocorrencias", "Financeiro consegue lançar ocorrência", async () => financeiroPostRes.status === 201)

  if (financeiroPostRes.status === 201) {
    const markPaidRes = await api(financeiroSession, "POST", `/api/company/occurrences/${financeiroPostRes.json.id}/mark-paid`, new FormData(), true)
    await check("3.Ocorrencias", "Financeiro consegue dar baixa (marcar como paga)", async () => markPaidRes.status === 200)
  } else {
    record("3.Ocorrencias", "Financeiro consegue dar baixa (marcar como paga)", false, "ocorrência não foi criada")
  }

  printSummary("ACESSO DO COLABORADOR A FINANCEIRO E OCORRÊNCIAS (RESTRIÇÃO) E PAPEL FINANCEIRO (CONCESSÃO)")

  // Limpeza
  await prisma.occurrence.deleteMany({ where: { companyId: company.id, description: { in: ["[Audit] ocorrência de outro colaborador", "[Audit] vale lançado pelo financeiro"] } } })
  await prisma.employeeProfile.update({ where: { userId: colaborador.id }, data: { canRegisterOccurrences: false, isFinanceResponsible: false } })

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
