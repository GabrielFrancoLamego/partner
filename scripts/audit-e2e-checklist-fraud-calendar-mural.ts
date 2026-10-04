import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, record, printSummary, results } from "./audit-lib"

/**
 * Auditoria do ciclo "Checklist Operacional (execução direta, auditoria de
 * Fraude/Execução Parcial, remoção do 'Não Executada' manual), Calendário
 * Operacional (dias fechados) e Mural (múltiplos anexos + moderação) e
 * Arquivamento de Conta — cobre as seções 1 (calendário), 2 (checklist), 3
 * (mural) e 6 (arquivamento) desta rodada. Idempotente — reseta os fixtures
 * no início e no fim.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const colaborador = await prisma.user.findUnique({ where: { email: "colaborador@teste.com.vc" } })
  const rafael = await prisma.user.findUnique({ where: { email: "rafael.jeri@teste.com.vc" } })
  if (!colaborador || !rafael) throw new Error("fixtures não encontradas")

  // Reset
  await prisma.user.update({ where: { id: rafael.id }, data: { status: "ACTIVE" } })
  await prisma.companyCalendarEvent.deleteMany({ where: { companyId: company.id, label: "[Audit] dia fechado teste" } })
  await prisma.checklist.deleteMany({ where: { companyId: company.id, title: { startsWith: "[Audit]" } } })
  await prisma.checklistTemplate.deleteMany({ where: { companyId: company.id, title: { startsWith: "[Audit]" } } })
  await prisma.post.deleteMany({ where: { companyId: company.id, content: "[Audit] post de teste com anexos" } })

  const masterSession = await loginAs("master@teste.com.vc")
  const gerenteSession = await loginAs("gerente@teste.com.vc")
  const colaboradorSession = await loginAs("colaborador@teste.com.vc")

  // --------------------------------------------------------------------------
  // SEÇÃO 2 — Checklist: execução direta sem popup (sem foto) + fim do "Não Executada" manual
  // --------------------------------------------------------------------------
  const templateRes = await api(gerenteSession, "POST", "/api/company/checklists/templates", {
    title: "[Audit] Tarefa sem foto",
    description: "teste",
    recurrence: "DAILY",
    dueTime: "23:59",
    requiresPhoto: false,
    requiresApproval: false,
    assignmentType: "SPECIFIC",
    primaryEmployeeId: colaborador.id,
  })
  await check("2.Checklist", "Gerente cria template sem exigência de foto/aprovação", async () => templateRes.status === 201)

  const listRes = await api(colaboradorSession, "GET", "/api/company/checklists")
  const todayChecklist = listRes.json?.checklists?.find((c: any) => c.template?.id === templateRes.json?.id)
  await check("2.Checklist", "Instância de hoje foi gerada pro colaborador", async () => Boolean(todayChecklist))

  if (todayChecklist) {
    const quickCompleteBody = new FormData()
    quickCompleteBody.append("action", "COMPLETE")
    const quickRes = await api(colaboradorSession, "POST", `/api/company/checklists/${todayChecklist.id}/submit`, quickCompleteBody, true)
    await check(
      "2.Checklist",
      "Execução direta (sem foto, sem popup) conclui a tarefa já como APPROVED",
      async () => quickRes.status === 200 && quickRes.json?.status === "APPROVED",
    )
  }

  // NOT_EXECUTED manual foi removido — a API não aceita mais essa ação.
  const template2Res = await api(gerenteSession, "POST", "/api/company/checklists/templates", {
    title: "[Audit] Tarefa 2",
    recurrence: "DAILY",
    dueTime: "23:59",
    requiresPhoto: false,
    requiresApproval: true,
    assignmentType: "SPECIFIC",
    primaryEmployeeId: colaborador.id,
  })
  const listRes2 = await api(colaboradorSession, "GET", "/api/company/checklists")
  const checklist2 = listRes2.json?.checklists?.find((c: any) => c.template?.id === template2Res.json?.id)
  if (checklist2) {
    const notExecutedBody = new FormData()
    notExecutedBody.append("action", "NOT_EXECUTED")
    notExecutedBody.append("justification", "teste")
    const notExecRes = await api(colaboradorSession, "POST", `/api/company/checklists/${checklist2.id}/submit`, notExecutedBody, true)
    await check("2.Checklist", "Ação manual 'NOT_EXECUTED' foi removida — API responde 400", async () => notExecRes.status === 400)
  } else {
    record("2.Checklist", "Ação manual 'NOT_EXECUTED' foi removida — API responde 400", false, "checklist2 não encontrado")
  }

  // --------------------------------------------------------------------------
  // SEÇÃO 2 — Auditoria do Gestor: Fraude (penalidade cheia) vs Parcial (penalidade reduzida)
  // --------------------------------------------------------------------------
  const rules = await prisma.internalProgram.findUnique({ where: { companyId: company.id } })
  const expectedFraudPoints = rules?.pointsChecklistFail ?? -5
  const expectedPartialPoints = rules?.pointsChecklistPartial ?? -2

  const makeSubmittedChecklist = () =>
    prisma.checklist.create({
      data: {
        companyId: company.id,
        employeeId: colaborador.id,
        requiresApproval: true,
        forDate: new Date(new Date().setHours(0, 0, 0, 0)),
        title: "[Audit] Submitted p/ auditoria",
        status: "SUBMITTED",
        submittedAt: new Date(),
        photoUrl: "https://placehold.co/10x10",
      },
    })

  const fraudChecklist = await makeSubmittedChecklist()
  const fraudRes = await api(gerenteSession, "PATCH", `/api/company/checklists/${fraudChecklist.id}`, {
    status: "REJECTED",
    note: "Fraude constatada",
    rejectionKind: "FRAUD",
  })
  await check("2.Auditoria", "Gerente recusa como Fraude/Não Executada", async () => fraudRes.status === 200)
  const fraudXp = await prisma.xpEntry.findFirst({ where: { sourceId: fraudChecklist.id }, orderBy: { createdAt: "desc" } })
  await check("2.Auditoria", "Fraude aplica a penalidade CHEIA configurada (pointsChecklistFail)", async () => fraudXp?.points === expectedFraudPoints)

  const partialChecklist = await makeSubmittedChecklist()
  const partialRes = await api(gerenteSession, "PATCH", `/api/company/checklists/${partialChecklist.id}`, {
    status: "REJECTED",
    note: "Execução incompleta",
    rejectionKind: "PARTIAL",
  })
  await check("2.Auditoria", "Gerente recusa como Parcialmente Executada", async () => partialRes.status === 200)
  const partialXp = await prisma.xpEntry.findFirst({ where: { sourceId: partialChecklist.id }, orderBy: { createdAt: "desc" } })
  await check(
    "2.Auditoria",
    "Execução Parcial aplica a penalidade REDUZIDA configurada (pointsChecklistPartial, distinta da Fraude)",
    async () => partialXp?.points === expectedPartialPoints && expectedPartialPoints !== expectedFraudPoints,
  )

  // --------------------------------------------------------------------------
  // SEÇÃO 1 — Calendário Operacional: dia fechado não gera instância de checklist
  // --------------------------------------------------------------------------
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closedEventRes = await api(masterSession, "POST", "/api/company/calendar-events", {
    date: today.toISOString(),
    kind: "CLOSED",
    label: "[Audit] dia fechado teste",
  })
  await check("1.Calendario", "Master cadastra hoje como Dia Fechado", async () => closedEventRes.status === 201)

  const template3Res = await api(gerenteSession, "POST", "/api/company/checklists/templates", {
    title: "[Audit] Tarefa dia fechado",
    recurrence: "DAILY",
    dueTime: "23:59",
    requiresPhoto: false,
    requiresApproval: false,
    assignmentType: "SPECIFIC",
    primaryEmployeeId: colaborador.id,
  })
  await api(colaboradorSession, "GET", "/api/company/checklists")
  const strandedAfterClosed = await prisma.checklist.findFirst({ where: { templateId: template3Res.json?.id, forDate: today } })
  await check("1.Calendario", "Nenhuma instância é gerada pro template num dia marcado como Fechado", async () => !strandedAfterClosed)

  if (closedEventRes.status === 201) {
    await api(masterSession, "DELETE", `/api/company/calendar-events/${closedEventRes.json.id}`)
  }
  await api(colaboradorSession, "GET", "/api/company/checklists")
  const createdAfterReopen = await prisma.checklist.findFirst({ where: { templateId: template3Res.json?.id, forDate: today } })
  await check("1.Calendario", "Removendo o Dia Fechado, a instância volta a ser gerada normalmente", async () => Boolean(createdAfterReopen))

  // --------------------------------------------------------------------------
  // SEÇÃO 3 — Mural: múltiplos anexos (imagem + PDF) + moderação do colaborador
  // --------------------------------------------------------------------------
  const imageBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" })
  const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" })
  const postForm = new FormData()
  postForm.append("content", "[Audit] post de teste com anexos")
  postForm.append("files", imageBlob, "foto.png")
  postForm.append("files", pdfBlob, "documento.pdf")
  const postRes = await api(colaboradorSession, "POST", "/api/company/posts", postForm, true)
  await check("3.Mural", "Colaborador publica com 2 anexos (imagem + PDF)", async () => postRes.status === 201)
  await check(
    "3.Mural",
    "Post de colaborador comum nasce PENDING_APPROVAL com os 2 attachmentUrls salvos",
    async () => postRes.json?.status === "PENDING_APPROVAL" && postRes.json?.attachmentUrls?.length === 2,
  )
  if (postRes.status === 201) await prisma.post.delete({ where: { id: postRes.json.id } }).catch(() => {})

  // --------------------------------------------------------------------------
  // SEÇÃO 6 — Arquivamento de Conta (exclusão aceita pelo Master)
  // --------------------------------------------------------------------------
  const gerenteArchiveRes = await api(gerenteSession, "PATCH", `/api/company/employees/${rafael.id}`, { status: "ARCHIVED" })
  await check("6.Arquivamento", "Gerente NÃO pode arquivar conta (403 — exclusivo do Master)", async () => gerenteArchiveRes.status === 403)

  const masterArchiveRes = await api(masterSession, "PATCH", `/api/company/employees/${rafael.id}`, { status: "ARCHIVED" })
  await check("6.Arquivamento", "Master aceita a exclusão — status vira ARCHIVED", async () => masterArchiveRes.status === 200)
  const rafaelArchived = await prisma.user.findUniqueOrThrow({ where: { id: rafael.id } })
  await check("6.Arquivamento", "Status persistido como ARCHIVED (histórico preservado)", async () => rafaelArchived.status === "ARCHIVED")

  const rafaelSession = await loginAs("rafael.jeri@teste.com.vc")
  const rafaelApiRes = await api(rafaelSession, "GET", "/api/company/dashboard")
  await check("6.Arquivamento", "Conta arquivada não consegue mais acessar a API (403)", async () => rafaelApiRes.status === 403)

  printSummary("CHECKLIST (FRAUDE/PARCIAL), CALENDÁRIO OPERACIONAL, MURAL (ANEXOS) E ARQUIVAMENTO DE CONTA")

  // Limpeza final
  await prisma.user.update({ where: { id: rafael.id }, data: { status: "ACTIVE" } })
  await prisma.checklist.deleteMany({ where: { companyId: company.id, title: { startsWith: "[Audit]" } } })
  await prisma.checklistTemplate.deleteMany({ where: { companyId: company.id, title: { startsWith: "[Audit]" } } })
  await prisma.companyCalendarEvent.deleteMany({ where: { companyId: company.id, label: "[Audit] dia fechado teste" } })

  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
