import "./audit-lib"
import ExcelJS from "exceljs"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, printSummary, results, settleForm, BASE_URL } from "./audit-lib"
import { googleMapsRouteUrl, whatsappUrl, telUrl, wazeRouteUrl } from "../lib/voucher-links"

/**
 * Auditoria: Ocorrências do Financeiro (visão dupla + quitação com comprovante),
 * Master/Admin com visão completa, localização com pin (lat/lng), gerador de
 * voucher sem fricção do parceiro, página pública do voucher (rota + telefone) e
 * unificação do menu de Promoções. Idempotente.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const TAG = "[AuditV]"

async function cleanup(startedAt: Date, ctx: { lagoaId: string; promoId: string; promoUsedBefore: number; lagoaBefore: Record<string, unknown>; partnerId: string }) {
  await prisma.financialSettlement.deleteMany({ where: { NOT: { description: { startsWith: "[Seed]" } }, OR: [{ description: { startsWith: TAG } }, { recipientName: { startsWith: TAG } }, { paidAt: { gte: startedAt } }] } })
  await prisma.occurrence.deleteMany({ where: { OR: [{ description: { startsWith: TAG } }, { employeeNameFreeText: { startsWith: TAG } }] } })
  await prisma.commission.deleteMany({ where: { qrCodeId: { startsWith: "voucher:" }, clientName: { startsWith: TAG } } })
  await prisma.promotionVoucher.deleteMany({ where: { clientName: { startsWith: TAG } } })
  await prisma.notification.deleteMany({ where: { userId: ctx.partnerId, createdAt: { gte: startedAt } } })
  await prisma.promotion.update({ where: { id: ctx.promoId }, data: { usedCount: ctx.promoUsedBefore } })
  await prisma.company.update({ where: { id: ctx.lagoaId }, data: ctx.lagoaBefore })
}

async function main() {
  const startedAt = new Date()
  const jeri = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-jeri" } })
  const lagoa = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-lagoa" } })
  const lagoaBefore = { address: lagoa.address, neighborhood: lagoa.neighborhood, city: lagoa.city, state: lagoa.state, zipCode: lagoa.zipCode, phone: lagoa.phone, latitude: lagoa.latitude, longitude: lagoa.longitude }
  const partner = await prisma.user.findUniqueOrThrow({ where: { email: "parceiro@teste.com.vc" } })
  const lagoaPromo = await prisma.promotion.findFirstOrThrow({ where: { companyId: lagoa.id, active: true, audience: "EXTERNAL" } })
  const jeriPromo = await prisma.promotion.findFirstOrThrow({ where: { companyId: jeri.id, active: true, audience: "EXTERNAL" } })
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: "ana.jeri@teste.com.vc" } })
  const flaggedUser = await prisma.user.findUniqueOrThrow({ where: { email: "financeiro@teste.com.vc" } })
  const ctx = { lagoaId: lagoa.id, promoId: lagoaPromo.id, promoUsedBefore: lagoaPromo.usedCount, lagoaBefore, partnerId: partner.id }
  const masterJeriUser = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, role: "COMPANY_MASTER" } })

  await cleanup(startedAt, ctx)

  const adminS = await loginAs("admin@teste.com.vc")
  const masterS = await loginAs("master@teste.com.vc")
  const gerenteS = await loginAs("gerente@teste.com.vc")
  const flaggedS = await loginAs("financeiro@teste.com.vc")
  const plainS = await loginAs("ana.jeri@teste.com.vc")
  const masterLagoaS = await loginAs("master.lagoa@teste.com.vc")
  const gerenteLagoaS = await loginAs("gerente.lagoa@teste.com.vc")
  const partnerS = await loginAs("parceiro@teste.com.vc")

  const createOccurrence = async (employeeId: string, type: string, value: number, description: string) => {
    const f = new FormData()
    f.append("employeeId", employeeId)
    f.append("type", type)
    f.append("value", String(value))
    f.append("description", `${TAG} ${description}`)
    return api(masterS, "POST", "/api/company/occurrences", f, true)
  }

  // ==========================================================================
  // 1. Ocorrências do usuário Financeiro (visão dupla + marcar como pago com comprovante)
  // ==========================================================================
  const anaTaxa = await createOccurrence(ana.id, "TAXA_SERVICO", 40, "taxa da Ana")
  const anaVale = await createOccurrence(ana.id, "VALE", 15, "vale da Ana (desconto)")
  const ownTaxa = await createOccurrence(flaggedUser.id, "TAXA_SERVICO", 22, "taxa do próprio financeiro")
  await check("1.Ocorrencias", "Setup: lançamentos criados pelo Master", async () => [anaTaxa, anaVale, ownTaxa].every((r) => r.status === 201) || "falha ao criar fixtures")

  await check("1.Ocorrencias", "Financeiro vê as próprias ocorrências (filtro por employeeId)", async () => {
    const { status, json } = await api(flaggedS, "GET", `/api/company/occurrences?employeeId=${flaggedUser.id}`)
    return (status === 200 && json.some((o: any) => o.id === ownTaxa.json.id) && json.every((o: any) => o.employee?.id === flaggedUser.id)) || "lista própria incorreta"
  })
  await check("1.Ocorrencias", "Pendentes de pagamento: traz as dos OUTROS colaboradores (Taxa da Ana) e nunca as próprias", async () => {
    const { status, json } = await api(flaggedS, "GET", "/api/company/occurrences?scope=pending-payments")
    return (status === 200 && json.some((o: any) => o.id === anaTaxa.json.id) && !json.some((o: any) => o.employee?.id === flaggedUser.id)) || "lista de pendentes incorreta"
  })
  await check("1.Ocorrencias", "Pendentes de pagamento só tem proventos — Vale (desconto) não aparece para pagar", async () => {
    const { json } = await api(flaggedS, "GET", "/api/company/occurrences?scope=pending-payments")
    return !json.some((o: any) => o.id === anaVale.json.id)
  })
  await check("1.Ocorrencias", "Colaborador comum não enxerga as de outros nem usa o escopo de pendências (só as próprias)", async () => {
    const { status, json } = await api(plainS, "GET", "/api/company/occurrences?scope=pending-payments")
    return (status === 200 && json.every((o: any) => o.employee?.id === ana.id)) || "colaborador comum viu dados de outros"
  })
  await check("1.Ocorrencias", "Marcar como pago editando a ocorrência é bloqueado (400) — exige comprovante", async () =>
    (await api(gerenteS, "PATCH", `/api/company/occurrences/${anaTaxa.json.id}`, { paymentStatus: "PAID" })).status === 400,
  )
  await check("1.Ocorrencias", "Marcar como Pago sem comprovante é bloqueado (400)", async () =>
    (await api(flaggedS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: anaTaxa.json.id }, { withFile: false }), true)).status === 400,
  )
  await check("1.Ocorrencias", "Financeiro NÃO quita pagamento em seu próprio nome (403)", async () =>
    (await api(flaggedS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: ownTaxa.json.id }), true)).status === 403,
  )
  await check("1.Ocorrencias", "Marcar como Pago com comprovante registra a quitação (comprovante, quem pagou) e sai das pendentes", async () => {
    const { status, json } = await api(flaggedS, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: anaTaxa.json.id }, { method: "PIX" }), true)
    const occ = await prisma.occurrence.findUniqueOrThrow({ where: { id: anaTaxa.json.id } })
    const pending = (await api(flaggedS, "GET", "/api/company/occurrences?scope=pending-payments")).json
    return (
      (status === 201 && occ.paymentStatus === "PAID" && Boolean(occ.paymentProofUrl) && occ.paidById === flaggedUser.id && Boolean(json.proofUrl) && !pending.some((o: any) => o.id === anaTaxa.json.id)) ||
      `status ${status} ${occ.paymentStatus}`
    )
  })

  // ==========================================================================
  // 2. Master e Admin: visão completa
  // ==========================================================================
  const external = await prisma.occurrence.create({
    data: { companyId: jeri.id, employeeNameFreeText: `${TAG} Diarista Externo`, type: "DIARIA", value: 55, quantity: 1, total: 55, paymentStatus: "PENDING", description: `${TAG} diária externa`, createdById: masterJeriUser.id },
  })
  await check("2.Admin", "Admin precisa informar a empresa para operar o Financeiro (400 sem companyId)", async () => (await api(adminS, "GET", "/api/company/finance/summary")).status === 400)
  await check("2.Admin", "Admin audita Contas a Pagar, Recebíveis, Quitações e Resumo de qualquer empresa (200)", async () => {
    const statuses = await Promise.all(["summary", "payables", "receivables", "settlements", "withdrawals"].map(async (p) => (await api(adminS, "GET", `/api/company/finance/${p}?companyId=${jeri.id}`)).status))
    return statuses.every((s) => s === 200) || statuses.join(",")
  })
  await check("2.Admin", "Admin enxerga a conta a pagar da empresa selecionada, e o Master de OUTRA empresa não", async () => {
    const asAdmin = (await api(adminS, "GET", `/api/company/finance/payables?companyId=${jeri.id}`)).json as any[]
    const asLagoaMaster = (await api(masterLagoaS, "GET", `/api/company/finance/payables?companyId=${jeri.id}`)).json as any[]
    return (asAdmin.some((r) => r.id === external.id) && !asLagoaMaster.some((r) => r.id === external.id)) || "escopo de empresa incorreto"
  })
  await check("2.Admin", "Master ignora ?companyId= de outra empresa (continua restrito à própria)", async () => {
    const asMaster = (await api(masterS, "GET", `/api/company/finance/payables?companyId=${lagoa.id}`)).json as any[]
    return asMaster.some((r) => r.id === external.id) || "Master saiu do próprio escopo"
  })
  await check("2.Admin", "Admin quita em nome de uma empresa (comprovante + forma) e a empresa errada não acha o item (404)", async () => {
    const wrong = await api(adminS, "POST", `/api/company/finance/settle?companyId=${lagoa.id}`, settleForm({ kind: "OCCURRENCE", id: external.id }), true)
    const ok = await api(adminS, "POST", `/api/company/finance/settle?companyId=${jeri.id}`, settleForm({ kind: "OCCURRENCE", id: external.id }, { method: "DINHEIRO" }), true)
    return (wrong.status === 404 && ok.status === 201) || `${wrong.status}/${ok.status}`
  })
  await check("2.Admin", "Admin audita Ocorrências globais: pagas com forma, quem pagou e comprovante; filtro por status e busca", async () => {
    const paid = (await api(adminS, "GET", `/api/admin/finance/occurrences?companyId=${jeri.id}&status=PAID&q=Ana`)).json as any[]
    const row = paid.find((r) => r.id === anaTaxa.json.id)
    const pending = (await api(adminS, "GET", `/api/admin/finance/occurrences?companyId=all&status=PENDING`)).json as any[]
    return (Boolean(row) && row.paymentMethod === "PIX" && row.paidBy?.name && row.paymentProofUrl && pending.every((r) => r.paymentStatus === "PENDING")) || JSON.stringify(row)
  })
  await check("2.Admin", "Admin audita Carteiras (parceiros e colaboradores) de uma empresa e do grupo", async () => {
    const one = (await api(adminS, "GET", `/api/admin/finance/wallets?companyId=${lagoa.id}`)).json
    const all = (await api(adminS, "GET", "/api/admin/finance/wallets?companyId=all")).json
    return (Array.isArray(one.partners) && Array.isArray(one.employees) && all.partners.some((p: any) => p.id === partner.id) && all.employees.length >= one.employees.length) || "carteiras inválidas"
  })
  await check("2.Admin", "Rotas de auditoria do Admin são exclusivas dele (Master 403)", async () => {
    const a = await api(masterS, "GET", "/api/admin/finance/occurrences")
    const b = await api(masterS, "GET", "/api/admin/finance/wallets")
    return (a.status === 403 && b.status === 403) || `${a.status}/${b.status}`
  })
  await check("2.Admin", "Admin exporta o relatório de qualquer empresa (Excel válido)", async () => {
    const cookie = [...adminS.jar.entries()].map(([k, v]: [string, string]) => `${k}=${v}`).join("; ")
    const res = await fetch(`${BASE_URL}/api/company/finance/export?tab=quitacoes&format=xlsx&companyId=${jeri.id}`, { headers: { Cookie: cookie } })
    const bytes = Buffer.from(await res.arrayBuffer())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(bytes as any)
    return (res.status === 200 && bytes.subarray(0, 2).toString() === "PK" && wb.worksheets[0].rowCount >= 2) || `status ${res.status}`
  })
  await check("2.Master", "Master audita extratos/quitações de qualquer colaborador da empresa (busca no Registro de Quitação)", async () => {
    const list = (await api(masterS, "GET", "/api/company/finance/settlements")).json as any[]
    return list.some((s) => s.sourceId === anaTaxa.json.id && s.recipientType === "EMPLOYEE" && s.proofUrl) || "quitação da Ana não encontrada"
  })

  // ==========================================================================
  // 3. Localização do estabelecimento (pin arrastável → latitude/longitude)
  // ==========================================================================
  await check("3.Mapa", "Master salva endereço, telefone/WhatsApp e coordenadas (pin)", async () => {
    const { status, json } = await api(masterLagoaS, "PATCH", "/api/company/location", {
      address: "Rua do Teste, 123",
      neighborhood: "Lagoa da Conceição",
      city: "Florianópolis",
      state: "SC",
      zipCode: "88062-000",
      phone: "(48) 99999-0000",
      latitude: -27.605432,
      longitude: -48.468123,
    })
    return (status === 200 && json.latitude === -27.605432 && json.longitude === -48.468123 && json.phone === "(48) 99999-0000") || JSON.stringify(json)
  })
  await check("3.Mapa", "GET devolve a localização salva; coordenadas inválidas ou incompletas são recusadas (400)", async () => {
    const got = await api(masterLagoaS, "GET", "/api/company/location")
    const badLat = await api(masterLagoaS, "PATCH", "/api/company/location", { latitude: 91, longitude: 10 })
    const onlyLat = await api(masterLagoaS, "PATCH", "/api/company/location", { latitude: -27.6 })
    return (got.json.latitude === -27.605432 && badLat.status === 400 && onlyLat.status === 400) || `${got.json.latitude}/${badLat.status}/${onlyLat.status}`
  })
  await check("3.Mapa", "Só o Master altera a localização (Gerente 403, Colaborador 403) e a busca de endereço exige texto (400)", async () => {
    const g = await api(gerenteLagoaS, "PATCH", "/api/company/location", { latitude: -27.6, longitude: -48.4 })
    const c = await api(plainS, "GET", "/api/company/location")
    const geo = await api(masterLagoaS, "GET", "/api/company/geo/geocode?q=ab")
    return (g.status === 403 && c.status === 403 && geo.status === 400) || `${g.status}/${c.status}/${geo.status}`
  })

  // ==========================================================================
  // 4. Gerador de voucher sem fricção
  // ==========================================================================
  const generate = (body: Record<string, unknown>, session: any = partnerS) =>
    api(session, "POST", "/api/partner/vouchers", { companyId: lagoa.id, promotionId: lagoaPromo.id, ...body })

  await check("4.Voucher", "Opções do gerador: estabelecimentos aderidos com as promoções vigentes", async () => {
    const { status, json } = await api(partnerS, "GET", "/api/partner/vouchers")
    const opt = json.find((o: any) => o.id === lagoa.id)
    return (status === 200 && Boolean(opt) && opt.promotions.some((p: any) => p.id === lagoaPromo.id && p.benefit) && !json.some((o: any) => o.id === jeri.id)) || JSON.stringify(json)
  })
  await check("4.Voucher", "Exige só nome + UM contato: sem nome (400), sem nenhum contato (400)", async () => {
    const a = await generate({ clientName: "", clientPhone: "(48) 99999-1111" })
    const b = await generate({ clientName: `${TAG} Sem Contato` })
    return (a.status === 400 && b.status === 400) || `${a.status}/${b.status}`
  })
  await check("4.Voucher", "Contato inválido é recusado (e-mail e telefone)", async () => {
    const a = await generate({ clientName: `${TAG} X`, clientEmail: "nao-e-email" })
    const b = await generate({ clientName: `${TAG} X`, clientPhone: "123" })
    return (a.status === 400 && b.status === 400) || `${a.status}/${b.status}`
  })
  const withPhone = await generate({ clientName: `${TAG} Cliente Whats`, clientPhone: "(48) 99999-1111" })
  await check("4.Voucher", "Só telefone/WhatsApp basta (sem e-mail): QR, link público e WhatsApp com mensagem pronta", async () => {
    const j = withPhone.json
    return (
      (withPhone.status === 201 && j.qrDataUrl.startsWith("data:image/png") && j.voucherUrl.includes("/voucher/") && Boolean(j.whatsappUrl) && j.whatsappUrl.startsWith("https://wa.me/5548999991111")) ||
      JSON.stringify(j).slice(0, 200)
    )
  })
  await check("4.Voucher", "Mensagem ao cliente traz benefício, endereço, rota (coordenadas exatas), telefone do local e link do voucher", async () => {
    const m: string = withPhone.json.message
    return (
      (m.includes("Benefício") &&
        m.includes("Rua do Teste, 123") &&
        m.includes("google.com/maps/dir/?api=1&destination=-27.605432%2C-48.468123") &&
        m.includes("(48) 99999-0000") &&
        m.includes(withPhone.json.voucherUrl)) ||
      m
    )
  })
  const withEmail = await generate({ clientName: `${TAG} Cliente Email`, clientEmail: "cliente@exemplo.com" })
  await check("4.Voucher", "Só e-mail basta (sem telefone) — não gera link de WhatsApp", async () => withEmail.status === 201 && withEmail.json.whatsappUrl === null)
  const noContact = await generate({ clientName: `${TAG} Cliente Sem Contato`, noContact: true })
  await check("4.Voucher", "'Cliente sem e-mail/WhatsApp': gera o QR só com o nome (canal manual, sem contatos gravados)", async () => {
    const v = await prisma.promotionVoucher.findUnique({ where: { code: noContact.json?.voucher?.code ?? "x" } })
    return (noContact.status === 201 && v?.channel === "manual" && v.clientEmail === null && v.clientPhone === null && v.clientName === `${TAG} Cliente Sem Contato`) || `status ${noContact.status}`
  })
  await check("4.Voucher", "Estabelecimento sem adesão ao programa é recusado (403)", async () => generate({ companyId: jeri.id, promotionId: jeriPromo.id, clientName: `${TAG} Z`, clientPhone: "(88) 99999-2222" }).then((r) => r.status === 403))

  // ==========================================================================
  // 5. Página pública do voucher (rota + telefone)
  // ==========================================================================
  const code: string = withPhone.json.voucher.code
  await check("5.PaginaPublica", "Voucher abre SEM login: QR, benefício e dados do estabelecimento com coordenadas e telefone", async () => {
    const res = await fetch(`${BASE_URL}/api/public/vouchers/${code}`)
    const j = await res.json()
    return (
      (res.status === 200 &&
        j.status === "VALID" &&
        j.qrDataUrl.startsWith("data:image/png") &&
        j.company.latitude === -27.605432 &&
        j.company.longitude === -48.468123 &&
        j.company.phone === "(48) 99999-0000" &&
        Boolean(j.promotion.benefit) &&
        j.partnerName === partner.name) ||
      JSON.stringify(j).slice(0, 200)
    )
  })
  await check("5.PaginaPublica", "Página /voucher/<código> responde sem sessão; código inexistente → 404", async () => {
    const page = await fetch(`${BASE_URL}/voucher/${code}`)
    const missing = await fetch(`${BASE_URL}/api/public/vouchers/inexistente123`)
    return (page.status === 200 && missing.status === 404) || `${page.status}/${missing.status}`
  })
  await check("5.PaginaPublica", "Links de rota e contato: Google Maps/Waze nas coordenadas exatas, tel: e WhatsApp com DDI", async () => {
    const c = { name: "Teste", latitude: -27.605432, longitude: -48.468123, phone: "(48) 99999-0000" }
    return (
      (googleMapsRouteUrl(c).includes("destination=-27.605432%2C-48.468123") &&
        wazeRouteUrl(c).includes("ll=-27.605432,-48.468123") &&
        telUrl(c.phone) === "tel:+5548999990000" &&
        whatsappUrl(c.phone)?.startsWith("https://wa.me/5548999990000")) ||
      "links incorretos"
    )
  })
  await check("5.PaginaPublica", "Baixa no PDV (Scanner) gera a comissão do parceiro que emitiu o voucher", async () => {
    const form = new FormData()
    form.append("qrPayload", `tribuss:voucher:${code}`)
    form.append("amount", "100")
    const redeem = await api(gerenteLagoaS, "POST", "/api/company/scanner/redeem", form, true)
    const commission = await prisma.commission.findUnique({ where: { qrCodeId: `voucher:${code}` } })
    const publicNow = await (await fetch(`${BASE_URL}/api/public/vouchers/${code}`)).json()
    const again = await api(gerenteLagoaS, "POST", "/api/company/scanner/redeem", (() => {
      const f = new FormData()
      f.append("qrPayload", `tribuss:voucher:${code}`)
      f.append("amount", "100")
      return f
    })(), true)
    return (
      (redeem.status === 200 &&
        commission?.partnerId === partner.id &&
        commission.status === "PENDING" &&
        Number(commission.commissionValue) === Number(lagoaPromo.cost) &&
        publicNow.status === "REDEEMED" &&
        again.status === 409) ||
      `redeem ${redeem.status} ${JSON.stringify(redeem.json)} commission ${commission?.partnerId} público ${publicNow.status} de novo ${again.status}`
    )
  })

  // ==========================================================================
  // 6. Menu do parceiro unificado
  // ==========================================================================
  await check("6.MenuParceiro", "'Descobrir Promo' redireciona para a aba de Descobrir dentro de Promoções", async () => {
    const cookie = [...partnerS.jar.entries()].map(([k, v]: [string, string]) => `${k}=${v}`).join("; ")
    const old = await fetch(`${BASE_URL}/partner/descobrir`, { headers: { Cookie: cookie }, redirect: "manual" })
    const page = await fetch(`${BASE_URL}/partner/promocoes?tab=descobrir`, { headers: { Cookie: cookie } })
    return ((old.status === 307 || old.status === 308) && (old.headers.get("location") ?? "").endsWith("/partner/promocoes?tab=descobrir") && page.status === 200) || `${old.status} ${old.headers.get("location")} ${page.status}`
  })
  await check("6.MenuParceiro", "Rota antiga de envio por promoção foi removida (substituída pelo gerador de voucher)", async () =>
    (await api(partnerS, "POST", `/api/partner/promotions/${lagoaPromo.id}/send`, { clientName: "x", clientPhone: "(48) 99999-1111" })).status === 404,
  )

  printSummary("OCORRÊNCIAS DO FINANCEIRO, ADMIN/MASTER, MAPA (PIN), VOUCHER DO PARCEIRO E PÁGINA PÚBLICA")

  await cleanup(startedAt, ctx)
  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
