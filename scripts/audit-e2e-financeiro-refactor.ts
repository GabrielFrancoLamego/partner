import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { randomUUID } from "crypto"
import ExcelJS from "exceljs"
import { loginAs, api, check, printSummary, results, settleForm, BASE_URL } from "./audit-lib"
import { addBusinessHours } from "../lib/business-time"

/**
 * Auditoria do módulo Financeiro refatorado (/company/financeiro): fila de
 * saques (aprovar/reprovar com justificativa), Contas a Pagar, pagamento com
 * forma + comprovante obrigatórios, Registro de Quitação, Recebíveis do
 * colaborador (projeção, pagamento de item e "Pagar total líquido"), lançamento
 * de valor de comissão e contadores/badge. Usa um colaborador temporário para
 * não mexer nos saldos das fixtures compartilhadas. Idempotente.
 */
const localDate = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const TEMP_EMAIL = "audit-recebiveis@teste.invalid"
const TAG = "[AuditFin]"

async function cleanup(companyId: string, startedAt: Date, partnerId: string, partnerWalletBefore: number) {
  const temp = await prisma.user.findUnique({ where: { email: TEMP_EMAIL } })
  // O seed de quitações ("[Seed]") é preservado — só some o que este teste gerou.
  await prisma.financialSettlement.deleteMany({
    where: { companyId, NOT: { description: { startsWith: "[Seed]" } }, OR: [{ paidAt: { gte: startedAt } }, { recipientName: { startsWith: TAG } }] },
  })
  await prisma.notification.deleteMany({ where: { userId: partnerId, type: { in: ["WITHDRAWAL_APPROVED", "PAYMENT_RECEIVED"] }, createdAt: { gte: startedAt } } })
  await prisma.occurrence.deleteMany({ where: { companyId, OR: [{ description: { startsWith: TAG } }, { employeeNameFreeText: { startsWith: TAG } }, ...(temp ? [{ employeeId: temp.id }] : [])] } })
  await prisma.withdrawal.deleteMany({ where: { companyId, pixKey: { startsWith: "audit-fin" } } })
  await prisma.commission.deleteMany({ where: { companyId, clientName: { startsWith: TAG } } })
  if (temp) {
    await prisma.notification.deleteMany({ where: { userId: temp.id } })
    await prisma.xpEntry.deleteMany({ where: { employeeId: temp.id } })
    await prisma.auditLog.deleteMany({ where: { entityId: temp.id } }).catch(() => {})
    await prisma.employeeProfile.deleteMany({ where: { userId: temp.id } })
    await prisma.user.delete({ where: { id: temp.id } }).catch(() => {})
  }
  await prisma.partnerProfile.update({ where: { userId: partnerId }, data: { walletBalance: partnerWalletBefore } })
}

async function main() {
  const startedAt = new Date()
  const company = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!company) throw new Error("Nomad's Jeri não encontrada")
  const partner = await prisma.user.findFirst({ where: { role: "PARTNER", partnerProfile: { isNot: null } }, include: { partnerProfile: true } })
  if (!partner?.partnerProfile) throw new Error("parceiro de fixture não encontrado")
  const master = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "COMPANY_MASTER" } })
  const walletBefore = Number(partner.partnerProfile.walletBalance)

  await cleanup(company.id, startedAt, partner.id, walletBefore)

  const masterS = await loginAs("master@teste.com.vc")
  const gerenteS = await loginAs("gerente@teste.com.vc")
  const flaggedS = await loginAs("financeiro@teste.com.vc") // EMPLOYEE com responsavelFinanceiro
  const plainS = await loginAs("ana.jeri@teste.com.vc") // colaborador comum, sem a flag

  const tempId = randomUUID()
  await prisma.user.create({ data: { id: tempId, email: TEMP_EMAIL, name: `${TAG} Colaborador Recebíveis`, role: "EMPLOYEE", companyId: company.id } })
  await prisma.employeeProfile.create({
    data: {
      userId: tempId,
      monthlySalary: 2000,
      employmentType: "FIXO",
      cpf: "00000000191",
      fullName: `${TAG} Nome Completo Temp`,
      bankName: "Banco Teste",
      accountType: "CORRENTE",
      agency: "0001",
      accountNumber: "12345-6",
      pixKey: "temp@pix.test",
    },
  })

  // --------------------------------------------------------------------------
  // 1. Acesso e contadores
  // --------------------------------------------------------------------------
  for (const [label, session] of [["Master", masterS], ["Gerente", gerenteS], ["Colaborador com responsavelFinanceiro", flaggedS]] as const) {
    await check("1.Acesso", `${label} acessa o resumo do Financeiro`, async () => (await api(session, "GET", "/api/company/finance/summary")).status === 200)
  }
  await check("1.Acesso", "Colaborador comum NÃO acessa o resumo (403)", async () => (await api(plainS, "GET", "/api/company/finance/summary")).status === 403)
  await check("1.Acesso", "Colaborador comum NÃO acessa Contas a Pagar, Recebíveis nem Registro de Quitação (403)", async () => {
    const statuses = await Promise.all(
      ["payables", "receivables", "settlements"].map(async (p) => (await api(plainS, "GET", `/api/company/finance/${p}`)).status),
    )
    return statuses.every((s) => s === 403) || `statuses ${statuses.join(",")}`
  })
  const summaryBefore = (await api(masterS, "GET", "/api/company/finance/summary")).json

  // --------------------------------------------------------------------------
  // 2. Fila de saques: aprovar / reprovar (com justificativa) — não paga
  // --------------------------------------------------------------------------
  const mkWithdrawal = (amount: number, pix: string) =>
    prisma.withdrawal.create({ data: { companyId: company.id, partnerId: partner.id, amount, status: "PENDING", pixKey: pix } })
  const w1 = await mkWithdrawal(33.33, "audit-fin-1")
  const w2 = await mkWithdrawal(44.44, "audit-fin-2")

  const summaryAfterW = (await api(masterS, "GET", "/api/company/finance/summary")).json
  await check("2.Saques", "Saque aguardando aprovação entra no badge de Saques (e no total do menu)", async () =>
    (summaryAfterW.tabs.withdrawals.count === summaryBefore.tabs.withdrawals.count + 2 && summaryAfterW.total === summaryBefore.total + 2) || JSON.stringify([summaryBefore, summaryAfterW]),
  )
  await check("2.Saques", "Saque PENDENTE (ainda não aprovado) NÃO aparece em Contas a Pagar", async () => {
    const { json } = await api(masterS, "GET", "/api/company/finance/payables")
    return !json.some((r: any) => r.id === w1.id)
  })
  await check("2.Saques", "Aprovar/reprovar não aceita 'PAID' (pagamento só em Contas a Pagar)", async () =>
    (await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w1.id}`, { status: "PAID" })).status === 400,
  )
  await check("2.Saques", "Reprovar sem justificativa é bloqueado (400)", async () =>
    (await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w2.id}`, { status: "REJECTED" })).status === 400,
  )
  await check("2.Saques", "Reprovar COM justificativa (Gerente) grava o motivo e estorna a carteira do parceiro", async () => {
    const before = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    const { status } = await api(gerenteS, "PATCH", `/api/company/finance/withdrawals/${w2.id}`, { status: "REJECTED", rejectionReason: "Dados divergentes" })
    const row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w2.id } })
    const after = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    return (status === 200 && row.status === "REJECTED" && row.rejectionReason === "Dados divergentes" && Math.abs(after - before - 44.44) < 0.01) || `status ${status} ${row.status} ${after - before}`
  })
  await check("2.Saques", "Aprovar (colaborador responsavelFinanceiro) marca approvedAt e move o saque para Contas a Pagar com dados PIX", async () => {
    const { status } = await api(flaggedS, "PATCH", `/api/company/finance/withdrawals/${w1.id}`, { status: "APPROVED" })
    const { json } = await api(masterS, "GET", "/api/company/finance/payables")
    const row = json.find((r: any) => r.id === w1.id)
    return (status === 200 && Boolean(row) && row.kind === "WITHDRAWAL" && row.banking.pixKey === "audit-fin-1" && Boolean(row.dueDate)) || `status ${status} row ${JSON.stringify(row)}`
  })
  await check("2.Saques", "Aprovar sem informar data atribui automaticamente 24 horas úteis a partir da aprovação", async () => {
    const row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w1.id } })
    if (!row.expectedPaymentDate || !row.approvedAt) return "expectedPaymentDate/approvedAt vazios"
    const expected = addBusinessHours(row.approvedAt, 24).getTime()
    return Math.abs(row.expectedPaymentDate.getTime() - expected) < 2000 || `esperado ${new Date(expected).toISOString()} veio ${row.expectedPaymentDate.toISOString()}`
  })
  const w4 = await mkWithdrawal(12.5, "audit-fin-4")
  const w5 = await mkWithdrawal(7.5, "audit-fin-5")
  const informed = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  informed.setSeconds(0, 0)
  await check("2.Saques", "Data/hora prevista informada na aprovação é gravada e vira o vencimento em Contas a Pagar", async () => {
    const { status } = await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w4.id}`, { status: "APPROVED", expectedPaymentDate: informed.toISOString() })
    const { json } = await api(masterS, "GET", "/api/company/finance/payables")
    const row = json.find((r: any) => r.id === w4.id)
    return (status === 200 && Boolean(row) && new Date(row.dueDate).getTime() === informed.getTime()) || `status ${status} row ${JSON.stringify(row)}`
  })
  await check("2.Saques", "Data prevista no passado é bloqueada (400) e data inválida também", async () => {
    const past = await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w5.id}`, { status: "APPROVED", expectedPaymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() })
    const bad = await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w5.id}`, { status: "APPROVED", expectedPaymentDate: "não-é-data" })
    return (past.status === 400 && bad.status === 400) || `${past.status}/${bad.status}`
  })
  await check("2.Saques", "Parceiro recebe notificação 'Saque aprovado' (WITHDRAWAL_APPROVED — dispara o som de moedas) com a data prevista", async () => {
    const n = await prisma.notification.findFirst({ where: { userId: partner.id, type: "WITHDRAWAL_APPROVED", createdAt: { gte: startedAt } }, orderBy: { createdAt: "desc" } })
    return (Boolean(n) && n!.message.includes("pagamento previsto")) || "notificação não encontrada"
  })
  await check("2.Saques", "Saque já analisado não pode ser analisado de novo (400)", async () =>
    (await api(masterS, "PATCH", `/api/company/finance/withdrawals/${w1.id}`, { status: "APPROVED" })).status === 400,
  )

  // --------------------------------------------------------------------------
  // 3. Contas a Pagar + pagamento com forma e comprovante obrigatórios
  // --------------------------------------------------------------------------
  const external = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeNameFreeText: `${TAG} Diarista Sem Cadastro`,
      type: "DIARIA",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      value: 80,
      quantity: 1,
      total: 80,
      paymentStatus: "PENDING",
      description: `${TAG} diária externa`,
      createdById: master.id,
    },
  })
  const payables = (await api(masterS, "GET", "/api/company/finance/payables")).json as any[]
  await check("3.ContasAPagar", "Lista em ordem cronológica de vencimento e inclui o favorecido sem cadastro", async () => {
    const times = payables.map((r) => new Date(r.dueDate).getTime())
    const sorted = [...times].sort((a, b) => a - b)
    return (JSON.stringify(times) === JSON.stringify(sorted) && payables.some((r) => r.id === external.id && r.banking.fullName.includes("Diarista Sem Cadastro"))) || "ordem/conteúdo inválido"
  })
  await check("3.ContasAPagar", "Pagamento a colaborador cadastrado NÃO aparece em Contas a Pagar (fica em Recebíveis)", async () => payables.every((r) => r.recipientType !== "EMPLOYEE"))
  await check("3.Pagar", "Pagar sem comprovante é bloqueado (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1.id }, { withFile: false }), true)).status === 400,
  )
  await check("3.Pagar", "Pagar sem forma de pagamento é bloqueado (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1.id }, { method: null }), true)).status === 400,
  )
  await check("3.Pagar", "Comprovante em formato inválido (texto) é bloqueado (400)", async () => {
    const form = new FormData()
    form.append("kind", "WITHDRAWAL")
    form.append("id", w1.id)
    form.append("paymentMethod", "PIX")
    form.append("file", new File(["oi"], "x.txt", { type: "text/plain" }))
    return (await api(masterS, "POST", "/api/company/finance/settle", form, true)).status === 400
  })
  await check("3.Pagar", "Consumo Interno não vale para saque de parceiro (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1.id }, { method: "CONSUMO" }), true)).status === 400,
  )
  await check("3.Pagar", "Saque ainda PENDENTE não pode ser pago direto (400)", async () => {
    const w3 = await mkWithdrawal(1, "audit-fin-3")
    return (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w3.id }), true)).status === 400
  })
  await check("3.Pagar", "Pagar saque aprovado (Pix + comprovante) → PAID, sai de Contas a Pagar", async () => {
    const { status, json } = await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1.id }, { method: "PIX" }), true)
    const row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w1.id } })
    const after = (await api(masterS, "GET", "/api/company/finance/payables")).json as any[]
    return (status === 201 && row.status === "PAID" && Boolean(row.proofOfPaymentUrl) && Boolean(json.proofUrl) && !after.some((r) => r.id === w1.id)) || `status ${status} ${row.status}`
  })
  await check("3.Pagar", "Pagar o mesmo saque de novo é bloqueado (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1.id }), true)).status === 400,
  )
  await check("3.Pagar", "Pagar a diária do favorecido sem cadastro (Dinheiro) → PAID", async () => {
    const { status } = await api(gerenteS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: external.id }, { method: "DINHEIRO" }), true)
    const row = await prisma.occurrence.findUniqueOrThrow({ where: { id: external.id } })
    return (status === 201 && row.paymentStatus === "PAID" && row.paymentMethod === "DINHEIRO") || `status ${status} ${row.paymentStatus}`
  })
  await check("3.Pagar", "Consumo Interno só para colaborador — diária sem cadastro bloqueia (400)", async () => {
    const ext2 = await prisma.occurrence.create({
      data: { companyId: company.id, employeeNameFreeText: `${TAG} Outro`, type: "DIARIA", value: 10, quantity: 1, total: 10, paymentStatus: "PENDING", description: `${TAG} x`, createdById: master.id },
    })
    return (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: ext2.id }, { method: "CONSUMO" }), true)).status === 400
  })

  // --------------------------------------------------------------------------
  // 4. Registro de Quitação
  // --------------------------------------------------------------------------
  const settlements = (await api(masterS, "GET", "/api/company/finance/settlements")).json as any[]
  await check("4.Quitacao", "Extrato traz saque e diária pagos com quem pagou, forma, valor e comprovante", async () => {
    const sw = settlements.find((s) => s.sourceId === w1.id)
    const se = settlements.find((s) => s.sourceId === external.id)
    return (
      (Boolean(sw) && sw.paymentMethod === "PIX" && sw.amount === 33.33 && Boolean(sw.proofUrl) && Boolean(sw.paidBy?.name) && Boolean(sw.paidAt) && sw.pixKey === "audit-fin-1" && Boolean(se) && se.paymentMethod === "DINHEIRO") ||
      "quitações não encontradas/campos faltando"
    )
  })
  await check("4.Quitacao", "Filtro por período futuro devolve lista vazia", async () => {
    const { json } = await api(masterS, "GET", "/api/company/finance/settlements?from=2999-01-01")
    return Array.isArray(json) && json.length === 0
  })
  await check("4.Quitacao", "Omie: campos de integração existem e começam sem sincronização", async () => {
    const sw = settlements.find((s) => s.sourceId === w1.id)
    return sw && "omieCodigoLancamento" in sw && "omieStatus" in sw && sw.omieStatus === null
  })

  // --------------------------------------------------------------------------
  // 5. Recebíveis do colaborador: projeção, pagamento de item e total líquido
  // --------------------------------------------------------------------------
  const rowOf = async () => {
    const { status, json } = await api(masterS, "GET", "/api/company/finance/receivables")
    return { status, row: json?.rows?.find((r: any) => r.employeeId === tempId) }
  }
  const mkOccurrence = async (session: any, type: string, value: number, description: string) => {
    const f = new FormData()
    f.append("employeeId", tempId)
    f.append("type", type)
    f.append("value", String(value))
    f.append("description", `${TAG} ${description}`)
    return api(session, "POST", "/api/company/occurrences", f, true)
  }

  const base = await rowOf()
  await check("5.Recebiveis", "Projeção do mês: salário 2000 → adiantamento 40% = 800 (dia 20) e saldo 60% pendentes", async () => {
    const p = base.row?.projection
    return (
      (base.status === 200 &&
        base.row.monthlySalary === 2000 &&
        Math.abs(p.adiantamento.paid + p.adiantamento.pending - 800) < 0.01 &&
        Math.abs(p.saldoSalario.paid + p.saldoSalario.pending - 1200) < 0.01 &&
        base.row.items.length === 2) ||
      JSON.stringify(base.row?.projection)
    )
  })

  const taxa = await mkOccurrence(masterS, "TAXA_SERVICO", 100, "taxa de serviço")
  const meta = await mkOccurrence(gerenteS, "META", 60, "meta batida")
  const vale = await mkOccurrence(masterS, "VALE", 40, "vale")
  const desc = await mkOccurrence(masterS, "DESCONTO_ESPECIAL", 10, "desconto")
  await check("5.Recebiveis", "Meta/Taxa/Vale/Desconto lançados via Ocorrências", async () => [taxa, meta, vale, desc].every((r) => r.status === 201) || JSON.stringify([taxa.status, meta.status, vale.status, desc.status]))
  await prisma.user.update({ where: { id: tempId }, data: { consumptionDebt: 30 } })

  const proj = await rowOf()
  await check("5.Recebiveis", "Recalcula sozinho: proventos 800+1200+100+60=2160, descontos 40+10, consumo 30 → líquido 2080", async () => {
    const t = proj.row?.totals
    return (
      (Math.abs(t.pendingEarnings - 2160) < 0.01 &&
        Math.abs(t.discounts - 50) < 0.01 &&
        t.consumo === 30 &&
        Math.abs(t.netRemaining - 2080) < 0.01 &&
        proj.row.projection.taxaServico.pending === 100 &&
        proj.row.projection.metas.pending === 60) ||
      JSON.stringify(t)
    )
  })
  await check("5.Recebiveis", "Vale e Desconto aparecem como descontos (não como itens a pagar)", async () =>
    proj.row.discountItems.length === 2 && !proj.row.items.some((i: any) => i.id === vale.json.id || i.id === desc.json.id),
  )
  await check("5.Recebiveis", "Contador de Recebíveis inclui os itens do colaborador", async () => {
    const s = (await api(masterS, "GET", "/api/company/finance/summary")).json
    // Taxa de Serviço e Meta (lançadas hoje) vencem hoje; Adiantamento/Saldo ainda não.
    return s.tabs.receivables.count >= summaryBefore.tabs.receivables.count + 2 || JSON.stringify(s.tabs.receivables)
  })
  await check("5.Recebiveis", "Descontos (Vale) não podem ser pagos como item (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: vale.json.id }), true)).status === 400,
  )
  await check("5.Recebiveis", "Consumo Interno acima do saldo devedor é bloqueado (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: taxa.json.id }, { method: "CONSUMO" }), true)).status === 400,
  )
  await check("5.Recebiveis", "Pagar item da meta (R$ 60) com Consumo Interno abate o saldo devedor (30 → bloqueia; com 80 → 20)", async () => {
    await prisma.user.update({ where: { id: tempId }, data: { consumptionDebt: 80 } })
    const { status } = await api(masterS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: meta.json.id }, { method: "CONSUMO" }), true)
    const u = await prisma.user.findUniqueOrThrow({ where: { id: tempId } })
    return (status === 201 && Number(u.consumptionDebt) === 20) || `status ${status} debt ${u.consumptionDebt}`
  })
  await prisma.user.update({ where: { id: tempId }, data: { consumptionDebt: 30 } })

  const afterItem = await rowOf()
  await check("5.Recebiveis", "Item pago sai dos pendentes e o líquido cai só o valor do item", async () =>
    !afterItem.row.items.some((i: any) => i.id === meta.json.id) && Math.abs(afterItem.row.totals.netRemaining - (2080 - 60)) < 0.01,
  )

  await check("5.Detalhamento", "Linha desdobra Salário, Adiantamento, Taxa, Vale/Consumo e Metas/Bônus (proventos e descontos, com a Conta de Consumo)", async () => {
    const cats = new Set(afterItem.row.breakdown.map((b: any) => b.category))
    const consumoLine = afterItem.row.breakdown.find((b: any) => b.kind === "CONSUMPTION")
    return (
      (["SALARIO", "ADIANTAMENTO", "TAXA_SERVICO", "VALE_CONSUMO", "METAS_BONUS", "DESCONTOS"].every((c) => cats.has(c)) && Boolean(consumoLine) && consumoLine.sign === -1 && consumoLine.amount === 30) ||
      JSON.stringify([...cats])
    )
  })
  await check("5.Parcial", "Seleção com item que não está pendente é recusada (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId, selection: JSON.stringify({ occurrenceIds: [meta.json.id], goalPayoutIds: [], consumption: false }) }), true)).status === 400,
  )
  await check("5.Parcial", "Seleção só de descontos (sem nenhum provento) é recusada (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId, selection: JSON.stringify({ occurrenceIds: [vale.json.id], goalPayoutIds: [], consumption: false }) }), true)).status === 400,
  )
  await check("5.Parcial", "Pagamento parcial: Taxa (100) + Vale marcado (40) = líquido 60, sem pagar o salário nem o restante", async () => {
    const selection = JSON.stringify({ occurrenceIds: [taxa.json.id, vale.json.id], goalPayoutIds: [], consumption: false })
    const { status, json } = await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId, selection }, { method: "PIX" }), true)
    const occ = await prisma.occurrence.findMany({ where: { id: { in: [taxa.json.id, vale.json.id] } } })
    const stillPending = await prisma.occurrence.count({ where: { employeeId: tempId, paymentStatus: "PENDING", type: "SALARIO" } })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: tempId } })
    return (
      (status === 201 && Math.abs(Number(json.amount) - 60) < 0.01 && json.description.startsWith("Itens selecionados") && occ.every((o) => o.paymentStatus === "PAID") && stillPending === 2 && Number(user.consumptionDebt) === 30) ||
      `status ${status} amount ${json?.amount} paid ${occ.map((o) => o.paymentStatus)} salário pendente ${stillPending} consumo ${user.consumptionDebt}`
    )
  })
  const afterPartial = await rowOf()
  await check("5.Parcial", "Depois do parcial restam salário (2000), desconto especial (10) e consumo (30) → líquido 1960", async () =>
    Math.abs(afterPartial.row.totals.netRemaining - 1960) < 0.01 || JSON.stringify(afterPartial.row.totals),
  )
  await check("5.Recebiveis", "Pagar total líquido: sem comprovante (400) e com Consumo Interno (400)", async () => {
    const a = await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId }, { withFile: false }), true)
    const b = await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId }, { method: "CONSUMO" }), true)
    return (a.status === 400 && b.status === 400) || `${a.status}/${b.status}`
  })
  const expectedNet = afterPartial.row.totals.netRemaining
  await check("5.Recebiveis", "Pagar total líquido quita proventos, abate vale/desconto e zera o consumo", async () => {
    const { status, json } = await api(flaggedS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId }, { method: "TRANSFERENCIA" }), true)
    const u = await prisma.user.findUniqueOrThrow({ where: { id: tempId } })
    const pending = await prisma.occurrence.count({ where: { employeeId: tempId, paymentStatus: "PENDING", total: { not: null } } })
    return (
      (status === 201 && json.sourceKind === "EMPLOYEE_NET" && Math.abs(Number(json.amount) - expectedNet) < 0.01 && Number(u.consumptionDebt) === 0 && pending === 0) ||
      `status ${status} amount ${json?.amount} esperado ${expectedNet} debt ${u.consumptionDebt} pend ${pending}`
    )
  })
  await check("5.Recebiveis", "Líquido pago aparece no Registro de Quitação com os dados bancários do colaborador", async () => {
    const list = (await api(masterS, "GET", "/api/company/finance/settlements")).json as any[]
    const s = list.find((x) => x.sourceKind === "EMPLOYEE_NET" && x.sourceId === tempId)
    return (Boolean(s) && s.paymentMethod === "TRANSFERENCIA" && s.pixKey === "temp@pix.test" && s.recipientDocument === "00000000191" && s.recipientName.includes("Nome Completo Temp")) || JSON.stringify(s)
  })
  await check("5.Recebiveis", "Sem nada pendente, pagar total líquido de novo é bloqueado (400)", async () =>
    (await api(masterS, "POST", "/api/company/finance/settle-employee", settleForm({ employeeId: tempId }), true)).status === 400,
  )
  await check("5.Recebiveis", "Meta/Bônus/Prêmio novo lançado em Ocorrências reaparece na projeção (recálculo automático)", async () => {
    const r = await mkOccurrence(masterS, "BONUS_ESPECIAL", 25, "bônus avulso")
    const again = await rowOf()
    return (r.status === 201 && Math.abs(again.row.totals.pendingEarnings - 25) < 0.01 && Math.abs(again.row.totals.netRemaining - 25) < 0.01) || JSON.stringify(again.row?.totals)
  })

  // --------------------------------------------------------------------------
  // 6. Comissões pendentes de lançamento
  // --------------------------------------------------------------------------
  const program = await prisma.program.findUnique({ where: { companyId: company.id } })
  const mkCommission = (name: string) =>
    prisma.commission.create({
      data: { companyId: company.id, partnerId: partner.id, programId: program?.id ?? null, clientName: `${TAG} ${name}`, amount: null, commissionValue: null, status: "AWAITING_VALUE", qrCodeId: randomUUID() },
    })
  const c1 = await mkCommission("cliente 1")
  const c2 = await mkCommission("cliente 2")
  await check("6.Comissoes", "Comissão sem valor da conta aparece na lista de pendentes", async () => {
    const { json } = await api(gerenteS, "GET", "/api/company/finance/commissions?pending=1")
    return json.some((c: any) => c.id === c1.id)
  })
  await check("6.Comissoes", "Lançar valor zerado exige justificativa (400)", async () =>
    (await api(gerenteS, "PATCH", `/api/company/finance/commissions/${c2.id}/launch`, { amount: 0 })).status === 400,
  )
  await check("6.Comissoes", "Gerente lança o valor da conta → comissão gerada (PENDING, valor calculado pelo programa)", async () => {
    const { status, json } = await api(gerenteS, "PATCH", `/api/company/finance/commissions/${c1.id}/launch`, { amount: 200 })
    const expected = program ? undefined : 0
    return (status === 200 && json.status === "PENDING" && Number(json.amount) === 200 && (expected === undefined ? json.commissionValue !== null : true)) || `status ${status} ${JSON.stringify(json)}`
  })
  await check("6.Comissoes", "Valor já lançado não pode ser lançado de novo (400)", async () =>
    (await api(gerenteS, "PATCH", `/api/company/finance/commissions/${c1.id}/launch`, { amount: 300 })).status === 400,
  )
  await check("6.Comissoes", "Colaborador comum NÃO lança valor de comissão (403)", async () =>
    (await api(plainS, "PATCH", `/api/company/finance/commissions/${c2.id}/launch`, { amount: 10 })).status === 403,
  )

  // --------------------------------------------------------------------------
  // 7. Badge do menu = soma exata dos badges das abas
  // --------------------------------------------------------------------------
  await check("7.Badge", "Total do menu = Contas a Pagar hoje + Saques aguardando + Recebíveis hoje (e cada parcela bate com a lista da aba)", async () => {
    const sum = (await api(masterS, "GET", "/api/company/finance/summary")).json
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const pay = ((await api(masterS, "GET", "/api/company/finance/payables")).json as any[]).filter((r) => new Date(r.dueDate) <= endOfToday).length
    const wd = await prisma.withdrawal.count({ where: { companyId: company.id, status: "PENDING" } })
    const rec = (await api(masterS, "GET", "/api/company/finance/receivables")).json.rows.reduce((n: number, r: any) => n + r.items.filter((i: any) => new Date(i.dueDate) <= endOfToday).length, 0)
    const parts = { pay, wd, rec }
    return (
      (sum.tabs.payables.count === pay && sum.tabs.withdrawals.count === wd && sum.tabs.receivables.count === rec && sum.total === pay + wd + rec) ||
      `summary ${JSON.stringify(sum)} listas ${JSON.stringify(parts)}`
    )
  })
  await check("7.Badge", "Menu e abas leem o MESMO resumo (Gerente vê o mesmo total que o Master)", async () => {
    const a = (await api(masterS, "GET", "/api/company/finance/summary")).json
    const b = (await api(gerenteS, "GET", "/api/company/finance/summary")).json
    return a.total === b.total || `${a.total} x ${b.total}`
  })

  // --------------------------------------------------------------------------
  // 8. Horas úteis, notificações sonoras e tela de acompanhamento do parceiro
  // --------------------------------------------------------------------------
  await check("8.HorasUteis", "24 horas úteis: sexta 15h → segunda 15h; segunda 10h → terça 10h; sábado → terça 00h", async () => {
    const fri = addBusinessHours(new Date(2026, 9, 9, 15, 0), 24)
    const mon = addBusinessHours(new Date(2026, 9, 5, 10, 0), 24)
    const sat = addBusinessHours(new Date(2026, 9, 10, 10, 0), 24)
    const ok = fri.getTime() === new Date(2026, 9, 12, 15, 0).getTime() && mon.getTime() === new Date(2026, 9, 6, 10, 0).getTime() && sat.getTime() === new Date(2026, 9, 13, 0, 0).getTime()
    return ok || `${fri.toISOString()} ${mon.toISOString()} ${sat.toISOString()}`
  })
  await check("8.Notificacoes", "Saque pago e líquido pago geram 'Valor recebido' (PAYMENT_RECEIVED) para parceiro e colaborador", async () => {
    const partnerN = await prisma.notification.findFirst({ where: { userId: partner.id, type: "PAYMENT_RECEIVED", createdAt: { gte: startedAt } } })
    const employeeN = await prisma.notification.findFirst({ where: { userId: tempId, type: "PAYMENT_RECEIVED" } })
    return (Boolean(partnerN) && Boolean(employeeN)) || `parceiro ${Boolean(partnerN)} colaborador ${Boolean(employeeN)}`
  })
  await check("8.Parceiro", "Tela 'Meus Saques Solicitados': parceiro vê status, data prevista, comprovante do pago e motivo do recusado", async () => {
    const partnerS = await loginAs(partner.email)
    const { status, json } = await api(partnerS, "GET", "/api/partner/withdrawals")
    const get = (id: string) => json.find((w: any) => w.id === id)
    const paid = get(w1.id)
    const approved = get(w4.id)
    const rejected = get(w2.id)
    return (
      (status === 200 &&
        paid?.status === "PAID" &&
        Boolean(paid.proofOfPaymentUrl) &&
        approved?.status === "APPROVED" &&
        new Date(approved.expectedPaymentDate).getTime() === informed.getTime() &&
        rejected?.status === "REJECTED" &&
        rejected.rejectionReason === "Dados divergentes") ||
      `status ${status} ${JSON.stringify([paid?.status, approved?.status, rejected?.status])}`
    )
  })

  // --------------------------------------------------------------------------
  // 9. Exportações reais (Excel e PDF) — gerados no servidor
  // --------------------------------------------------------------------------
  const fetchFile = async (session: any, path: string) => {
    const cookie = [...session.jar.entries()].map(([k, v]: [string, string]) => `${k}=${v}`).join("; ")
    const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookie } })
    return { res, bytes: Buffer.from(await res.arrayBuffer()) }
  }
  for (const tab of ["contas-a-pagar", "comissoes-saques", "recebiveis", "quitacoes"]) {
    await check("9.Exportacao", `${tab}: Excel (.xlsx) válido, com cabeçalhos completos`, async () => {
      const { res, bytes } = await fetchFile(masterS, `/api/company/finance/export?tab=${tab}&format=xlsx`)
      if (res.status !== 200) return `status ${res.status} ${bytes.toString().slice(0, 120)}`
      if (bytes.subarray(0, 2).toString() !== "PK") return "não é um .xlsx (assinatura ZIP ausente)"
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(bytes as any)
      const headers = wb.worksheets.flatMap((ws) => (ws.getRow(1).values as any[]).filter(Boolean))
      const expected =
        tab === "quitacoes"
          ? ["Favorecido", "CPF/CNPJ", "Chave PIX", "Valor", "Forma de pagamento", "Motivo", "Comprovante"]
          : tab === "contas-a-pagar"
            ? ["Favorecido", "CPF/CNPJ", "Banco", "Chave PIX", "Valor", "Vencimento", "Motivo"]
            : ["Valor"]
      const missing = expected.filter((h) => !headers.includes(h))
      return (missing.length === 0 && /spreadsheetml/.test(res.headers.get("content-type") ?? "")) || `faltam colunas: ${missing.join(", ")}`
    })
    await check("9.Exportacao", `${tab}: PDF válido`, async () => {
      const { res, bytes } = await fetchFile(gerenteS, `/api/company/finance/export?tab=${tab}&format=pdf`)
      return (res.status === 200 && bytes.subarray(0, 4).toString() === "%PDF" && bytes.length > 1500 && res.headers.get("content-type") === "application/pdf") || `status ${res.status} ${bytes.length} bytes`
    })
  }
  await check("9.Exportacao", "Quitações: o período (from/to) filtra estritamente a exportação — futuro vem sem linhas, hoje traz as pagas", async () => {
    const today = localDate()
    const countRows = async (qs: string) => {
      const { bytes } = await fetchFile(masterS, `/api/company/finance/export?tab=quitacoes&format=xlsx&${qs}`)
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(bytes as any)
      return wb.worksheets[0].rowCount - 1
    }
    const future = await countRows("from=2999-01-01&to=2999-12-31")
    const current = await countRows(`from=${today}&to=${today}`)
    const apiToday = (await api(masterS, "GET", `/api/company/finance/settlements?from=${today}&to=${today}`)).json.length
    return (future === 0 && current >= 3 && current === apiToday) || `futuro ${future} hoje ${current} api ${apiToday}`
  })
  await check("9.Exportacao", "Exportação traz o comprovante como link; Colaborador comum não exporta (403); aba inválida (400)", async () => {
    const { bytes } = await fetchFile(masterS, "/api/company/finance/export?tab=quitacoes&format=xlsx")
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes as any)
    const sheet = wb.worksheets[0]
    const proofCol = (sheet.getRow(1).values as any[]).indexOf("Comprovante")
    const cell = sheet.getRow(2).getCell(proofCol).value as any
    const plain = await fetchFile(plainS, "/api/company/finance/export?tab=quitacoes&format=pdf")
    const invalid = await fetchFile(masterS, "/api/company/finance/export?tab=xyz&format=pdf")
    return (Boolean(cell?.hyperlink) && plain.res.status === 403 && invalid.res.status === 400) || `link ${JSON.stringify(cell)} plain ${plain.res.status} invalid ${invalid.res.status}`
  })

  // --------------------------------------------------------------------------
  // 10. Filtro padrão de 30 dias + seed e trava de ganhos só por Ocorrências
  // --------------------------------------------------------------------------
  await check("10.Quitacoes", "Seed (scripts/seed-quitacoes.ts) presente nos últimos 30 dias; intervalo menor filtra estritamente", async () => {
    const day = (offset: number) => localDate(offset)
    const last30 = (await api(masterS, "GET", `/api/company/finance/settlements?from=${day(-30)}&to=${day(0)}`)).json as any[]
    const last7 = (await api(masterS, "GET", `/api/company/finance/settlements?from=${day(-7)}&to=${day(0)}`)).json as any[]
    const seeded = last30.filter((r) => r.description.startsWith("[Seed]"))
    const inRange = last7.every((r) => new Date(r.paidAt) >= new Date(`${day(-7)}T00:00:00`))
    const sortedDesc = last30.every((r, i) => i === 0 || new Date(last30[i - 1].paidAt) >= new Date(r.paidAt))
    return (seeded.length >= 10 && last7.length < last30.length && inRange && sortedDesc) || `seed ${seeded.length} 30d ${last30.length} 7d ${last7.length} faixa ${inRange} ordem ${sortedDesc}`
  })
  await check("10.TravaGanhos", "Não existe lançamento direto de ganho no Financeiro (rota goal-payouts removida → 404)", async () =>
    (await api(masterS, "POST", "/api/company/finance/goal-payouts", { goalId: "x", employeeId: tempId, amount: 10, period: "2026-10" })).status === 404,
  )

  printSummary("MÓDULO FINANCEIRO REFATORADO (SAQUES, CONTAS A PAGAR, RECEBÍVEIS, QUITAÇÃO, COMISSÕES)")

  await cleanup(company.id, startedAt, partner.id, walletBefore)
  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
