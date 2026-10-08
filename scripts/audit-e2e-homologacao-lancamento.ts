import "./audit-lib"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loginAs, api, check, printSummary, results, settleForm, startOfDay, crossesMidnight, BASE_URL } from "./audit-lib"
import { addBusinessHours } from "../lib/business-time"

/**
 * HOMOLOGAÇÃO DE LANÇAMENTO — bateria de lógica ponta a ponta:
 *  1. Pontuação & gamificação (checklist no prazo, ponto GPS, ajuste de ponto, reflexo em
 *     dashboard/badge/ranking/trilha, privacidade do ranking)
 *  2. Ocorrências & impacto financeiro (Elogio, Advertência, Vale, Bônus, Atestado → "Sua Conta")
 *  3. Metas (progresso %, faixas, prêmio automático na folha de recebíveis)
 *  4. Jornada do Parceiro (voucher → Scanner PDV → comissão → saque PIX → quitação com comprovante)
 *  6. Prontidão PWA/lojas (manifest, ícones, assetlinks, SW, exclusão de conta, política de privacidade)
 * Idempotente; restaura XP, carteira e contadores no fim.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const TAG = "[Homol]"

const minutesAgoHHmm = (m: number) => {
  const d = new Date(Date.now() - m * 60 * 1000)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
const png = () => new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], "foto.png", { type: "image/png" })

async function main() {
  const startedAt = new Date()
  const pousada = await prisma.company.findUniqueOrThrow({ where: { slug: "pousada-vento-norte-e2e" } })
  const lagoa = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-lagoa" } })
  const A = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorA@pousada-e2e.teste.com.vc" } })
  const B = await prisma.user.findUniqueOrThrow({ where: { email: "colaboradorB@pousada-e2e.teste.com.vc" } })
  const partner = await prisma.user.findUniqueOrThrow({ where: { email: "parceiro@teste.com.vc" }, include: { partnerProfile: true } })
  const promo = await prisma.promotion.findFirstOrThrow({ where: { companyId: lagoa.id, active: true, audience: "EXTERNAL" } })
  const profileA = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: A.id } })
  const profileB = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: B.id } })
  const partnerProfile = partner.partnerProfile!

  const original = {
    xpA: profileA.xpPoints,
    xpB: profileB.xpPoints,
    salaryA: profileA.monthlySalary,
    scheduleA: { workStartTime: profileA.workStartTime, workEndTime: profileA.workEndTime, bankOfHoursMinutes: profileA.bankOfHoursMinutes },
    wallet: partnerProfile.walletBalance,
    partnerCpf: partnerProfile.cpf,
    partnerPix: partnerProfile.pixKey,
    promoUsed: promo.usedCount,
  }

  const cleanup = async () => {
    await prisma.financialSettlement.deleteMany({ where: { NOT: { description: { startsWith: "[Seed]" } }, OR: [{ paidAt: { gte: startedAt } }, { recipientName: { startsWith: TAG } }] } })
    await prisma.occurrence.deleteMany({ where: { OR: [{ description: { startsWith: TAG } }, { companyId: pousada.id, employeeId: { in: [A.id, B.id] }, createdAt: { gte: startedAt } }] } })
    await prisma.checklist.deleteMany({ where: { title: { startsWith: TAG } } })
    await prisma.goalPayout.deleteMany({ where: { goal: { name: { startsWith: TAG } } } })
    await prisma.occurrence.deleteMany({ where: { companyId: pousada.id, type: "META", description: { contains: TAG } } })
    await prisma.goalRecord.deleteMany({ where: { goal: { name: { startsWith: TAG } } } })
    await prisma.goalTier.deleteMany({ where: { goal: { name: { startsWith: TAG } } } })
    await prisma.goal.deleteMany({ where: { name: { startsWith: TAG } } })
    await prisma.occurrenceTypeConfig.deleteMany({ where: { name: { startsWith: TAG } } })
    await prisma.timeclockAdjustmentReview.deleteMany({ where: { employeeId: { in: [A.id, B.id] }, date: { gte: startOfDay() } } })
    await prisma.timeEntry.deleteMany({ where: { userId: { in: [A.id, B.id] }, createdAt: { gte: startOfDay() } } })
    await prisma.xpEntry.deleteMany({ where: { employeeId: { in: [A.id, B.id] }, createdAt: { gte: startedAt } } })
    await prisma.commission.deleteMany({ where: { qrCodeId: { startsWith: "voucher:" }, clientName: { startsWith: TAG } } })
    await prisma.walletTransaction.deleteMany({ where: { description: { contains: TAG } } })
    await prisma.withdrawal.deleteMany({ where: { pixKey: { startsWith: "homol-" } } })
    await prisma.promotionVoucher.deleteMany({ where: { clientName: { startsWith: TAG } } })
    await prisma.notification.deleteMany({ where: { userId: { in: [A.id, B.id, partner.id] }, createdAt: { gte: startedAt } } })
    await prisma.employeeProfile.update({
      where: { userId: A.id },
      data: { xpPoints: original.xpA, monthlySalary: original.salaryA, ...original.scheduleA },
    })
    await prisma.employeeProfile.update({ where: { userId: B.id }, data: { xpPoints: original.xpB } })
    await prisma.partnerProfile.update({ where: { userId: partner.id }, data: { walletBalance: original.wallet, cpf: original.partnerCpf, pixKey: original.partnerPix } })
    await prisma.promotion.update({ where: { id: promo.id }, data: { usedCount: original.promoUsed } })
    await prisma.user.updateMany({ where: { id: { in: [A.id, partner.id] } }, data: { accountDeletionStatus: "NONE", accountDeletionRequestedAt: null, accountDeletionReason: null } })
  }
  await cleanup()

  const master = await loginAs("master@pousada-e2e.teste.com.vc")
  const gerente = await loginAs("gerente@pousada-e2e.teste.com.vc")
  const sA = await loginAs(A.email)
  const sB = await loginAs(B.email)
  const adminS = await loginAs("admin@teste.com.vc")
  const xp = async (id: string) => (await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: id } })).xpPoints

  // ==========================================================================
  // 1. PONTUAÇÃO & GAMIFICAÇÃO
  // ==========================================================================
  await prisma.timeEntry.deleteMany({ where: { userId: { in: [A.id, B.id] }, createdAt: { gte: startOfDay() } } })
  const lat = Number(pousada.latitude)
  const lng = Number(pousada.longitude)

  await check("1.Pontuacao", "Ponto GPS: batida DENTRO do geofence é aceita; FORA (~50 km) é recusada", async () => {
    const far = await api(sB, "POST", "/api/company/timeclock", { type: "CHECK_IN", latitude: lat + 0.5, longitude: lng })
    const near = await api(sB, "POST", "/api/company/timeclock", { type: "CHECK_IN", latitude: lat, longitude: lng })
    return (far.status >= 400 && far.status < 500 && near.status === 201) || `fora ${far.status} dentro ${near.status}`
  })

  await check("1.Pontuacao", "Checklist entregue NO PRAZO e aprovado credita Pts positivos", async () => {
    const before = await xp(A.id)
    const form = new FormData()
    form.set("title", `${TAG} checklist no prazo`)
    form.set("priority", "MEDIUM")
    form.set("file", png())
    const created = await api(sA, "POST", "/api/company/checklists", form, true)
    if (created.status !== 201) return `criação ${created.status}`
    await prisma.checklist.update({ where: { id: created.json.id }, data: { dueAt: new Date(Date.now() + 60 * 60 * 1000) } })
    const approved = await api(gerente, "PATCH", `/api/company/checklists/${created.json.id}`, { status: "APPROVED" })
    const after = await xp(A.id)
    return (approved.status === 200 && after > before) || `aprovação ${approved.status} xp ${before}→${after}`
  })

  await check("1.Pontuacao", "Pts refletem na hora: dashboard (Meu Progresso), badge do header (summary) e banco batem", async () => {
    const dbXp = await xp(A.id)
    const dash = (await api(sA, "GET", "/api/company/dashboard")).json
    const summary = (await api(sA, "GET", "/api/company/gamification/summary")).json
    return (dash.me.xpPoints === dbXp && summary.me.xpPoints === dbXp && typeof dash.me.monthlyScore === "number") || `db ${dbXp} dash ${dash.me?.xpPoints} summary ${summary.me?.xpPoints}`
  })

  await check("1.Pontuacao", "Atraso no ponto só desconta Pts APÓS a Gerência confirmar (com justificativa), e reflete no dashboard", async () => {
    if (crossesMidnight(20)) return true // ignorado: horário "há 20 min" cairia no dia anterior (ver crossesMidnight)
    await prisma.employeeProfile.update({ where: { userId: A.id }, data: { workStartTime: minutesAgoHHmm(20), bankOfHoursMinutes: 0 } })
    const punch = await api(sA, "POST", "/api/company/timeclock", { type: "CHECK_IN", latitude: lat, longitude: lng })
    const afterPunch = await xp(A.id)
    const before = afterPunch
    const noReason = await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", { employeeId: A.id, kind: "LATE_CHECKIN", apply: true })
    const applied = await api(gerente, "POST", "/api/company/shift-closing/timeclock-adjustments", { employeeId: A.id, kind: "LATE_CHECKIN", apply: true, justification: "Chegou 20 min após o horário" })
    const after = await xp(A.id)
    const dash = (await api(sA, "GET", "/api/company/dashboard")).json
    return (punch.status === 201 && noReason.status === 400 && applied.status === 200 && after < before && dash.me.xpPoints === after) || `punch ${punch.status} semMotivo ${noReason.status} aplicar ${applied.status} xp ${before}→${after}`
  })

  await check("1.Ranking", "Ranking do colaborador: posição própria + pódio só com 1º nome, sem id/sobrenome/Pts de colegas", async () => {
    const { status, json } = await api(sA, "GET", "/api/company/gamification/summary")
    const rows = json.leaderboard as any[]
    const mine = rows.find((r) => r.isMe)
    const others = rows.filter((r) => !r.isMe)
    const leaks = others.some((r) => "employeeId" in r || "name" in r || r.xpPoints !== null || (r.displayName && r.displayName.includes(" ")))
    const podiumHasNames = rows.filter((r) => r.rank <= 3 && !r.isMe).every((r) => r.displayName)
    return (status === 200 && Boolean(mine) && json.myRank === mine.rank && !leaks && podiumHasNames) || `leaderboard ${JSON.stringify(rows).slice(0, 220)}`
  })
  await check("1.Ranking", "Dashboard do colaborador traz só a própria posição (ex: '3º Lugar') e nenhum nome de colega", async () => {
    const dash = (await api(sA, "GET", "/api/company/dashboard")).json
    const text = JSON.stringify(dash)
    return (Number.isInteger(dash.me.rank) && dash.me.totalRanked >= dash.me.rank && dash.master === null && !text.includes(B.name)) || "dashboard vazou dados de colegas"
  })
  await check("1.Ranking", "Gestão (Gerente) enxerga o ranking completo com Pts e ids", async () => {
    const { json } = await api(gerente, "GET", "/api/company/gamification/summary")
    return (json.leaderboard.length >= 2 && json.leaderboard.every((r: any) => r.employeeId && r.name && typeof r.xpPoints === "number")) || "ranking da gestão incompleto"
  })
  await check("1.Trilha", "Trilha de Cargos/Crescimento (Jeri): níveis ordenados e progresso coerente com os Pts do colaborador", async () => {
    const jeriColab = await loginAs("colaborador@teste.com.vc")
    const { json } = await api(jeriColab, "GET", "/api/company/gamification/summary")
    const levels = json.levels as any[]
    const ordered = levels.every((l, i) => i === 0 || l.pointsRequired >= levels[i - 1].pointsRequired)
    const me = json.me
    const coherent = !me.nextLevel || me.nextLevel.pointsRequired > me.xpPoints || me.pendingPromotionLevel
    return (levels.length >= 2 && ordered && Boolean(coherent) && me.progressToNextPercent >= 0 && me.progressToNextPercent <= 100) || JSON.stringify(me).slice(0, 200)
  })

  // ==========================================================================
  // 2. OCORRÊNCIAS & IMPACTO FINANCEIRO
  // ==========================================================================
  await prisma.employeeProfile.update({ where: { userId: A.id }, data: { monthlySalary: 3000 } })
  const occ = async (session: any, fields: Record<string, string>, withFile = false) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.set(k, v)
    if (withFile) f.set("file", png())
    return api(session, "POST", "/api/company/occurrences", f, true)
  }
  const account = async () => (await api(sA, "GET", "/api/company/my-account")).json

  let elogioTypeId = ""
  await check("2.Ocorrencias", "Elogio (tipo configurável de Pts): Master cria o tipo e o lançamento credita Pts", async () => {
    const type = await api(master, "POST", "/api/company/occurrence-types", { name: `${TAG} Elogio`, kind: "POINTS", pointsImpact: 5 })
    if (type.status !== 201) return `tipo ${type.status} ${JSON.stringify(type.json)}`
    elogioTypeId = type.json.id
    const before = await xp(A.id)
    const r = await occ(master, { employeeId: A.id, type: "CUSTOM", customTypeId: elogioTypeId, description: `${TAG} elogio` })
    return (r.status === 201 && (await xp(A.id)) === before + 5) || `lançamento ${r.status}`
  })
  await check("2.Ocorrencias", "Advertência (anexo obrigatório) penaliza Pts; sem anexo é recusada (400)", async () => {
    const before = await xp(A.id)
    const noFile = await occ(gerente, { employeeId: A.id, type: "ADVERTENCIA", description: `${TAG} sem anexo` })
    const ok = await occ(gerente, { employeeId: A.id, type: "ADVERTENCIA", description: `${TAG} advertência` }, true)
    return (noFile.status === 400 && ok.status === 201 && (await xp(A.id)) < before) || `semAnexo ${noFile.status} ok ${ok.status}`
  })
  const accBefore = await account()
  await check("2.Ocorrencias", "Vale recalcula 'Sua Conta': aparece em Descontos/Vales", async () => {
    const r = await occ(gerente, { employeeId: A.id, type: "VALE", value: "30", description: `${TAG} vale` })
    const acc = await account()
    return (r.status === 201 && Math.abs(acc.discounts.vales - accBefore.discounts.vales - 30) < 0.01) || `vale ${r.status} ${acc.discounts.vales}`
  })
  await check("2.Ocorrencias", "Bônus Especial (Master) recalcula 'Sua Conta': soma aos ganhos a receber; Gerente não consegue (403)", async () => {
    const denied = await occ(gerente, { employeeId: A.id, type: "BONUS_ESPECIAL", value: "100", description: `${TAG} bônus negado` })
    const r = await occ(master, { employeeId: A.id, type: "BONUS_ESPECIAL", value: "100", description: `${TAG} bônus` })
    const acc = await account()
    return (denied.status === 403 && r.status === 201 && Math.abs(acc.earnings.outrosAdicionais.pending - accBefore.earnings.outrosAdicionais.pending - 100) < 0.01) || `negado ${denied.status} bônus ${r.status}`
  })
  await check("2.Ocorrencias", "Desconto Especial (Master) entra em Descontos Diversos da 'Sua Conta'", async () => {
    const r = await occ(master, { employeeId: A.id, type: "DESCONTO_ESPECIAL", value: "20", description: `${TAG} desconto` })
    const acc = await account()
    return (r.status === 201 && Math.abs(acc.discounts.descontosDiversos - accBefore.discounts.descontosDiversos - 20) < 0.01) || `desconto ${r.status}`
  })
  await check("2.Ocorrencias", "Atestado (anexo) em até 24h abona a Falta do dia — o desconto da falta some", async () => {
    const falta = await occ(gerente, { employeeId: A.id, type: "FALTA", description: `${TAG} falta` })
    const atestado = await occ(gerente, { employeeId: A.id, type: "ATESTADO", description: `${TAG} atestado` }, true)
    const row = await prisma.occurrence.findUnique({ where: { id: falta.json?.id ?? "x" } })
    return (falta.status === 201 && atestado.status === 201 && row?.discountWaived === true) || `falta ${falta.status} atestado ${atestado.status} abonada ${row?.discountWaived}`
  })
  await check("2.Ocorrencias", "Colaborador vê SÓ as ocorrências em seu nome, em modo somente leitura (POST/PATCH/DELETE → 403)", async () => {
    const mine = await api(sA, "GET", "/api/company/occurrences")
    const others = await api(sB, "GET", "/api/company/occurrences")
    const sample = mine.json[0]
    const post = await occ(sA, { employeeId: A.id, type: "VALE", value: "5", description: `${TAG} tentativa` })
    const patch = await api(sA, "PATCH", `/api/company/occurrences/${sample.id}`, { description: "x" })
    const del = await api(sA, "DELETE", `/api/company/occurrences/${sample.id}`)
    const onlyOwn = mine.json.every((o: any) => o.employee?.id === A.id) && others.json.every((o: any) => o.employee?.id !== A.id)
    return (onlyOwn && post.status === 403 && patch.status === 403 && del.status === 403) || `propria ${onlyOwn} post ${post.status} patch ${patch.status} del ${del.status}`
  })
  await check("2.Financeiro", "Financeiro quita só com comprovante (sem arquivo → 400) e 'Sua Conta' move de pendente para recebido", async () => {
    const taxa = await occ(master, { employeeId: A.id, type: "TAXA_SERVICO", value: "80", description: `${TAG} taxa` })
    const before = await account()
    const noProof = await api(gerente, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: taxa.json.id }, { withFile: false }), true)
    const ok = await api(gerente, "POST", "/api/company/finance/settle", settleForm({ kind: "OCCURRENCE", id: taxa.json.id }, { method: "PIX" }), true)
    const after = await account()
    return (
      (noProof.status === 400 && ok.status === 201 && Math.abs(after.earnings.taxaServico.paid - before.earnings.taxaServico.paid - 80) < 0.01 && Math.abs(before.earnings.taxaServico.pending - after.earnings.taxaServico.pending - 80) < 0.01) ||
      `semComprovante ${noProof.status} quitar ${ok.status}`
    )
  })

  // ==========================================================================
  // 3. METAS & DESEMPENHO
  // ==========================================================================
  let goalId = ""
  await check("3.Metas", "Master cria meta diária com 2 faixas e ela aparece no dashboard (Metas Ativas) dos colaboradores", async () => {
    const created = await api(master, "POST", "/api/company/goals", {
      scope: "COMPANY",
      period: "DAILY",
      name: `${TAG} Meta Diária`,
      tiers: [
        { targetAmount: 10, bonusAmount: 5, rewardType: "CASH" },
        { targetAmount: 20, bonusAmount: 8, rewardType: "CASH" },
      ],
    })
    if (created.status !== 201) return `criar ${created.status} ${JSON.stringify(created.json)}`
    goalId = created.json.id
    const progress = (await api(sA, "GET", "/api/company/goals/progress")).json as any[]
    return progress.some((g) => g.id === goalId) || "meta não apareceu no progresso do colaborador"
  })
  const record = (amount: number) => {
    const f = new FormData()
    f.set("amount", String(amount))
    return api(gerente, "POST", `/api/company/goals/${goalId}/records`, f, true)
  }
  await check("3.Metas", "Progresso: R$12 bate a 1ª faixa (20% rumo à 2ª, faltam R$8) e o prêmio da faixa entra para quem está presente", async () => {
    const r = await record(12)
    await new Promise((res) => setTimeout(res, 400))
    const g = ((await api(sA, "GET", "/api/company/goals/progress")).json as any[]).find((x) => x.id === goalId)
    const payouts = await prisma.goalPayout.findMany({ where: { goalId } })
    return (r.status === 201 && g.currentAmount === 12 && g.progressToNextPercent === 20 && g.remainingToNext === 8 && payouts.length >= 1 && payouts.every((p) => Number(p.amount) === 5)) || `progresso ${JSON.stringify(g)} payouts ${payouts.length}`
  })
  await check("3.Metas", "Superar a 2ª faixa (total do dia R$25) paga o prêmio adicional (R$8) sem duplicar a 1ª (idempotente)", async () => {
    // O resultado da meta é o TOTAL do dia (reenviar substitui) — 25 supera a 2ª faixa (20); reenviar 25 não duplica.
    await record(25)
    await record(25)
    await new Promise((res) => setTimeout(res, 400))
    const payouts = await prisma.goalPayout.findMany({ where: { goalId } })
    const perEmployee = new Map<string, number>()
    for (const p of payouts) perEmployee.set(p.employeeId, (perEmployee.get(p.employeeId) ?? 0) + Number(p.amount))
    return ([...perEmployee.values()].every((v) => v === 13) && payouts.length === perEmployee.size * 2) || `payouts ${payouts.map((p) => Number(p.amount))}`
  })
  await check("3.Metas", "Prêmios caem na folha de Recebíveis (Metas/Premiações) e na 'Sua Conta' do colaborador", async () => {
    const rec = (await api(master, "GET", "/api/company/finance/receivables")).json
    const row = rec.rows.find((r: any) => r.employeeId === B.id)
    const acc = (await api(sB, "GET", "/api/company/my-account")).json
    return (row.projection.metas.paid + row.projection.metas.pending >= 13 && acc.earnings.metas.paid >= 13) || `recebíveis ${JSON.stringify(row?.projection?.metas)} sua conta ${JSON.stringify(acc.earnings.metas)}`
  })

  // ==========================================================================
  // 4. JORNADA DO PARCEIRO
  // ==========================================================================
  const finLagoa = await loginAs("financeiro.lagoa@teste.com.vc")
  const gerLagoa = await loginAs("gerente.lagoa@teste.com.vc")
  const partnerS = await loginAs("parceiro@teste.com.vc")
  await prisma.partnerProfile.update({ where: { userId: partner.id }, data: { cpf: partnerProfile.cpf ?? "00000000191", pixKey: partnerProfile.pixKey ?? "homol-pix-perfil" } })

  const gen = (body: Record<string, unknown>) => api(partnerS, "POST", "/api/partner/vouchers", { companyId: lagoa.id, promotionId: promo.id, ...body })
  await check("4.Voucher", "Nome + um contato obrigatórios (sem nome 400, sem contato 400); telefone OU e-mail basta", async () => {
    const a = await gen({ clientName: "", clientPhone: "(48) 99999-1111" })
    const b = await gen({ clientName: `${TAG} X` })
    const c = await gen({ clientName: `${TAG} Só Telefone`, clientPhone: "(48) 99999-1111" })
    const d = await gen({ clientName: `${TAG} Só Email`, clientEmail: "homol@exemplo.com" })
    return (a.status === 400 && b.status === 400 && c.status === 201 && d.status === 201) || `${a.status}/${b.status}/${c.status}/${d.status}`
  })
  let noContactCode = ""
  await check("4.Voucher", "'Cliente Sem Contato': QR grande + estabelecimento, benefício e endereço disponíveis para foto/WhatsApp", async () => {
    const r = await gen({ clientName: `${TAG} Sem Contato`, noContact: true })
    if (r.status !== 201) return `status ${r.status}`
    noContactCode = r.json.voucher.code
    const pub = await (await fetch(`${BASE_URL}/api/public/vouchers/${noContactCode}`)).json()
    return (
      (r.json.qrDataUrl.startsWith("data:image/png") && r.json.whatsappUrl === null && r.json.message.includes(lagoa.name) && r.json.message.includes("Benefício") && pub.company.name === lagoa.name && Boolean(pub.promotion.benefit) && pub.status === "VALID") ||
      JSON.stringify(r.json).slice(0, 200)
    )
  })
  let commissionId = ""
  await check("4.Scanner", "PDV lê o voucher, lança a comanda com FOTO e gera a comissão PENDENTE do parceiro", async () => {
    const f = new FormData()
    f.set("qrPayload", `tribuss:voucher:${noContactCode}`)
    f.set("amount", "250")
    f.set("file", png())
    const r = await api(gerLagoa, "POST", "/api/company/scanner/redeem", f, true)
    const c = await prisma.commission.findUnique({ where: { qrCodeId: `voucher:${noContactCode}` } })
    commissionId = c?.id ?? ""
    return (r.status === 200 && c?.partnerId === partner.id && c.status === "PENDING" && Number(c.amount) === 250 && Boolean(c.billAttachmentUrl)) || `redeem ${r.status} ${JSON.stringify(r.json)}`
  })
  let walletAfterApproval = 0
  await check("4.Comissao", "Financeiro aprova a comissão: valor entra na carteira do parceiro, extrato registra e o parceiro é notificado", async () => {
    const before = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    const r = await api(finLagoa, "PATCH", `/api/company/finance/commissions/${commissionId}`, { status: "APPROVED", commissionValue: 40 })
    const after = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    walletAfterApproval = after
    const tx = await prisma.walletTransaction.findFirst({ where: { partnerId: partner.id, type: "COMMISSION", createdAt: { gte: startedAt } } })
    const n = await prisma.notification.findFirst({ where: { userId: partner.id, type: "COMMISSION_EARNED", createdAt: { gte: startedAt } } })
    return (r.status === 200 && Math.abs(after - before - 40) < 0.01 && Boolean(tx) && Boolean(n)) || `aprovar ${r.status} carteira ${before}→${after} tx ${Boolean(tx)} notif ${Boolean(n)}`
  })
  const requestWithdrawal = (amount: number, n: number) => api(partnerS, "POST", "/api/partner/withdrawals", { amount, companyId: lagoa.id, pixKey: `homol-pix-${n}` })
  let w1 = ""
  let w2 = ""
  await check("4.Saque", "Parceiro solicita saques; saldo é retido (debitado) na solicitação e saque acima do saldo é recusado", async () => {
    const tooMuch = await requestWithdrawal(walletAfterApproval + 1000, 0)
    const a = await requestWithdrawal(15, 1)
    const b = await requestWithdrawal(10, 2)
    const wallet = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    w1 = a.json?.id
    w2 = b.json?.id
    return (tooMuch.status === 400 && a.status === 201 && b.status === 201 && Math.abs(wallet - (walletAfterApproval - 25)) < 0.01) || `excesso ${tooMuch.status} ${a.status}/${b.status} carteira ${wallet}`
  })
  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  inTwoDays.setSeconds(0, 0)
  await check("4.Saque", "Aprovação com Data/Hora prevista informada; sem data → prazo automático de 24h úteis; parceiro é notificado", async () => {
    const a = await api(finLagoa, "PATCH", `/api/company/finance/withdrawals/${w1}`, { status: "APPROVED", expectedPaymentDate: inTwoDays.toISOString() })
    const b = await api(finLagoa, "PATCH", `/api/company/finance/withdrawals/${w2}`, { status: "APPROVED" })
    const rowA = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w1 } })
    const rowB = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w2 } })
    const auto = rowB.approvedAt ? addBusinessHours(rowB.approvedAt, 24).getTime() : 0
    const notifs = await prisma.notification.count({ where: { userId: partner.id, type: "WITHDRAWAL_APPROVED", createdAt: { gte: startedAt } } })
    return (
      (a.status === 200 && b.status === 200 && rowA.expectedPaymentDate?.getTime() === inTwoDays.getTime() && rowB.expectedPaymentDate?.getTime() === auto && notifs === 2) ||
      `${a.status}/${b.status} notifs ${notifs}`
    )
  })
  await check("4.Quitacao", "Pagamento do PIX exige comprovante; ao pagar vira PAID, registra a quitação e notifica o parceiro", async () => {
    const noProof = await api(finLagoa, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1 }, { withFile: false }), true)
    const paid = await api(finLagoa, "POST", "/api/company/finance/settle", settleForm({ kind: "WITHDRAWAL", id: w1 }, { method: "PIX" }), true)
    const row = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w1 } })
    const notif = await prisma.notification.findFirst({ where: { userId: partner.id, type: "PAYMENT_RECEIVED", createdAt: { gte: startedAt } } })
    const mine = (await api(partnerS, "GET", "/api/partner/withdrawals")).json as any[]
    const seen = mine.find((w) => w.id === w1)
    return (
      (noProof.status === 400 && paid.status === 201 && row.status === "PAID" && Boolean(notif) && seen?.status === "PAID" && Boolean(seen.proofOfPaymentUrl)) ||
      `semComprovante ${noProof.status} pagar ${paid.status} status ${row.status}`
    )
  })
  await check("4.Saque", "Saque reprovado devolve o valor à carteira com justificativa visível ao parceiro", async () => {
    const extra = await requestWithdrawal(5, 3)
    const walletBefore = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    const noReason = await api(finLagoa, "PATCH", `/api/company/finance/withdrawals/${extra.json.id}`, { status: "REJECTED" })
    const rej = await api(finLagoa, "PATCH", `/api/company/finance/withdrawals/${extra.json.id}`, { status: "REJECTED", rejectionReason: "PIX divergente do cadastro" })
    const walletAfter = Number((await prisma.partnerProfile.findUniqueOrThrow({ where: { userId: partner.id } })).walletBalance)
    const seen = ((await api(partnerS, "GET", "/api/partner/withdrawals")).json as any[]).find((w) => w.id === extra.json.id)
    return (noReason.status === 400 && rej.status === 200 && Math.abs(walletAfter - walletBefore - 5) < 0.01 && seen.rejectionReason === "PIX divergente do cadastro") || `${noReason.status}/${rej.status}`
  })

  // ==========================================================================
  // 6. PRONTIDÃO PWA / LOJAS
  // ==========================================================================
  const manifest = await (await fetch(`${BASE_URL}/manifest.json`)).json()
  await check("6.PWA", "manifest.json: nome, short_name, start_url, display standalone, cores de tema e idioma", async () => {
    const ok = manifest.name && manifest.short_name && manifest.start_url === "/" && manifest.display === "standalone" && manifest.theme_color && manifest.background_color && manifest.lang === "pt-BR" && manifest.id
    return Boolean(ok) || JSON.stringify(manifest).slice(0, 200)
  })
  await check("6.PWA", "manifest: ícones 192/512 (any) e 192/512 maskable existem, são PNG e têm a dimensão declarada", async () => {
    for (const icon of manifest.icons as any[]) {
      const res = await fetch(`${BASE_URL}${icon.src}`)
      const bytes = Buffer.from(await res.arrayBuffer())
      const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
      if (res.status !== 200 || bytes.subarray(1, 4).toString() !== "PNG" || `${w}x${h}` !== icon.sizes) return `ícone ${icon.src}: status ${res.status} ${w}x${h} (declarado ${icon.sizes})`
    }
    const purposes = new Set((manifest.icons as any[]).map((i) => `${i.purpose}:${i.sizes}`))
    return ["any:192x192", "any:512x512", "maskable:192x192", "maskable:512x512"].every((p) => purposes.has(p)) || [...purposes].join(",")
  })
  await check("6.PWA", "Metadados do app: theme-color/viewport, manifest e apple-touch-icon declarados no HTML", async () => {
    const html = await (await fetch(`${BASE_URL}/`)).text()
    const apple = await fetch(`${BASE_URL}/icons/apple-touch-icon-180.png`)
    return (html.includes('rel="manifest"') && html.includes(manifest.theme_color) && /viewport-fit=cover/.test(html) && html.includes("apple-touch-icon") && apple.status === 200) || "metadados incompletos no HTML"
  })
  await check("6.PWA", "Service Worker e página offline são servidos", async () => {
    const sw = await fetch(`${BASE_URL}/sw.js`)
    const offline = await fetch(`${BASE_URL}/offline`)
    return (sw.status === 200 && /javascript/.test(sw.headers.get("content-type") ?? "") && offline.status === 200) || `sw ${sw.status} offline ${offline.status}`
  })
  await check("6.Lojas", "assetlinks.json é servido como JSON válido no formato do Google (Digital Asset Links)", async () => {
    const res = await fetch(`${BASE_URL}/.well-known/assetlinks.json`)
    const json = await res.json()
    const entry = json[0]
    return (res.status === 200 && /json/.test(res.headers.get("content-type") ?? "") && entry.relation.includes("delegate_permission/common.handle_all_urls") && entry.target.namespace === "android_app" && Boolean(entry.target.package_name) && Array.isArray(entry.target.sha256_cert_fingerprints)) || JSON.stringify(json).slice(0, 200)
  })
  const fingerprint = (await (await fetch(`${BASE_URL}/.well-known/assetlinks.json`)).json())[0]?.target?.sha256_cert_fingerprints?.[0] as string
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(fingerprint)) {
    console.log("\n⚠ PENDÊNCIA DE PUBLICAÇÃO (Play Store): public/.well-known/assetlinks.json ainda tem o fingerprint de exemplo. Troque pelo SHA-256 da chave de assinatura do app (Play Console > Integridade do app) antes de publicar.\n")
  }
  await check("6.Lojas", "Exclusão de conta (Apple 5.1.1): Parceiro e Colaborador solicitam, não duplicam (409), e Admin/Master são avisados", async () => {
    const partnerReq = await api(partnerS, "POST", "/api/account/deletion-request", { reason: `${TAG} teste` })
    const partnerAgain = await api(partnerS, "POST", "/api/account/deletion-request", {})
    const employeeReq = await api(sA, "POST", "/api/account/deletion-request", { reason: `${TAG} teste` })
    const status = await api(sA, "GET", "/api/account/deletion-request")
    const adminNotified = await prisma.notification.count({ where: { type: "ACCOUNT_DELETION_REQUESTED", message: { contains: partner.name }, createdAt: { gte: startedAt } } })
    const masterNotified = await prisma.notification.count({ where: { type: "ACCOUNT_DELETION_REQUESTED", message: { contains: A.name }, createdAt: { gte: startedAt } } })
    return (
      (partnerReq.status === 200 && partnerAgain.status === 409 && employeeReq.status === 200 && status.json.accountDeletionStatus === "ACCOUNT_DELETION_REQUESTED" && adminNotified >= 1 && masterNotified >= 1) ||
      `${partnerReq.status}/${partnerAgain.status}/${employeeReq.status} avisos ${adminNotified}/${masterNotified}`
    )
  })
  await check("6.Lojas", "Páginas públicas exigidas pelas lojas: Política de Privacidade e Termos de Uso respondem sem login", async () => {
    const [priv, terms] = await Promise.all([fetch(`${BASE_URL}/privacidade`), fetch(`${BASE_URL}/termos`)])
    const text = await priv.text()
    return (priv.status === 200 && terms.status === 200 && text.includes("exclusão")) || `privacidade ${priv.status} termos ${terms.status}`
  })
  await check("6.Lojas", "Telas de Perfil com 'Solicitar exclusão de conta' montadas para Parceiro e Colaborador", async () => {
    const cookie = (s: any) => [...s.jar.entries()].map(([k, v]: [string, string]) => `${k}=${v}`).join("; ")
    const [p, c] = await Promise.all([
      fetch(`${BASE_URL}/partner/perfil`, { headers: { Cookie: cookie(partnerS) } }),
      fetch(`${BASE_URL}/company/perfil`, { headers: { Cookie: cookie(sA) } }),
    ])
    return (p.status === 200 && c.status === 200) || `${p.status}/${c.status}`
  })
  void adminS

  printSummary("HOMOLOGAÇÃO DE LANÇAMENTO (PONTUAÇÃO, OCORRÊNCIAS, METAS, JORNADA DO PARCEIRO, PWA/LOJAS)")

  await cleanup()
  if (results.some((r) => !r.pass)) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
