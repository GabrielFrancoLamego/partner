/**
 * Segunda leva da auditoria E2E — continuação de scripts/audit-e2e-simulation.ts:
 *   0. Limpeza definitiva: arquiva a empresa "Teste" e reativa a IN-ON.
 *   A. Testes unitários puros de cálculo de comissão (todas as combinações).
 *   B. Duas empresas fictícias novas com equipe completa, setores, horários e
 *      checklists de recorrências variadas.
 *   C. Matriz de variações do Programa de Parceria (tipo/formato de comissão).
 *   D. Níveis do programa (todos os critérios) + progressão real de um parceiro.
 *   E. Matriz de variações de Promoção (todos os offerType) + esgotamento de estoque.
 *   F. Fechamento de Caixa — os 3 passos obrigatórios, de ponta a ponta.
 *   G. Escalonamento de Checklist (principal ausente -> secundário -> Gerente/Master).
 *   H. Dashboards do Admin, CEP, mapas do parceiro — smoke tests.
 *
 * Requer: `npm run dev` rodando em http://localhost:3000.
 * Uso: npx tsx scripts/audit-e2e-full-variations.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { BASE_URL, SUPABASE_URL, PASSWORD, randomValidCpf, check, printSummary, results, loginAs, api, type Session } from "./audit-lib"
import { computeReferralCommissionValue } from "../lib/commission-format"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const supabaseAdmin = createAdminClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createOrGetAuthUser(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) {
    if (error?.message.includes("already been registered") || error?.status === 422) {
      for (let page = 1; page <= 50; page++) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (listErr) throw listErr
        const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
        if (found) return found
        if (list.users.length < 200) break
      }
    }
    throw error
  }
  return data.user
}

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

async function main() {
  console.log(`\n=== AUDITORIA E2E — VARIAÇÕES E FLUXOS PENDENTES — ${new Date().toISOString()} ===`)
  console.log(`Base URL: ${BASE_URL}\n`)

  const admin = await loginAs("admin@teste.com.vc")

  // ===========================================================================
  // FASE 0 — limpeza definitiva (dados reais, não é fixture reversível)
  // ===========================================================================
  console.log("--- FASE 0: limpeza de dados reais ---")

  await check("0.Limpeza", "Arquiva a empresa 'Teste' (teste1)", async () => {
    const teste = await prisma.company.findUnique({ where: { slug: "teste1" } })
    if (!teste) return "empresa 'teste1' não encontrada — já foi removida antes"
    if (teste.isArchived) return true
    const { status } = await api(admin, "DELETE", `/api/admin/companies/${teste.id}`)
    if (status !== 200) return `status ${status}`
    return true
  })

  await check("0.Limpeza", "Reativa a IN-ON (estava INACTIVE sem motivo conhecido)", async () => {
    const inOn = await prisma.company.findUniqueOrThrow({ where: { slug: "in-on" } })
    if (inOn.status === "ACTIVE") return true
    const { status, json } = await api(admin, "PATCH", `/api/admin/companies/${inOn.id}`, {
      status: "ACTIVE",
      blockReason: "Auditoria E2E — empresa estava INACTIVE sem log de auditoria explicando o motivo; reativada.",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  // ===========================================================================
  // FASE A — cálculo de comissão: todas as combinações tipo × formato (função pura)
  // ===========================================================================
  console.log("\n--- FASE A: cálculo de comissão — todas as combinações ---")

  await check("A.Comissao", "PERCENTAGE/VARIABLE — 10% de R$200 = R$20", async () => {
    const v = computeReferralCommissionValue({ commissionType: "VARIABLE", commissionFormat: "PERCENTAGE", commissionValue: 10, fixedValue: null }, 200)
    return v === 20 || `esperado 20, veio ${v}`
  })
  await check("A.Comissao", "FIXED_VALUE/FIXED — R$35 fixo, ignora o valor da conta", async () => {
    const v = computeReferralCommissionValue({ commissionType: "FIXED", commissionFormat: "FIXED_VALUE", commissionValue: 35, fixedValue: null }, 999)
    return v === 35 || `esperado 35, veio ${v}`
  })
  await check("A.Comissao", "PRODUCT_UNIT/FIXED — devolve a quantidade de unidades, não R$", async () => {
    const v = computeReferralCommissionValue({ commissionType: "FIXED", commissionFormat: "PRODUCT_UNIT", commissionValue: 1, fixedValue: null }, 500)
    return v === 1 || `esperado 1 (1 diária grátis), veio ${v}`
  })
  await check("A.Comissao", "PERCENTAGE/BOTH — 10% de R$200 + R$15 fixo = R$35", async () => {
    const v = computeReferralCommissionValue({ commissionType: "BOTH", commissionFormat: "PERCENTAGE", commissionValue: 10, fixedValue: 15 }, 200)
    return v === 35 || `esperado 35, veio ${v}`
  })
  await check("A.Comissao", "Arredondamento — 12.5% de R$33,33 arredonda para 2 casas", async () => {
    const v = computeReferralCommissionValue({ commissionType: "VARIABLE", commissionFormat: "PERCENTAGE", commissionValue: 12.5, fixedValue: null }, 33.33)
    return v === 4.17 || `esperado 4.17, veio ${v}`
  })

  // ===========================================================================
  // FASE B — duas empresas fictícias completas
  // ===========================================================================
  console.log("\n--- FASE B: empresas fictícias completas (Pousada Vento Norte, Restaurante Maresia) ---")

  const pousada = await prisma.company.upsert({
    where: { slug: "pousada-vento-norte-e2e" },
    update: { status: "ACTIVE" },
    create: {
      name: "Pousada Vento Norte (E2E)",
      slug: "pousada-vento-norte-e2e",
      status: "ACTIVE",
      city: "Jijoca de Jericoacoara",
      state: "CE",
      latitude: -2.8,
      longitude: -40.51,
      geofenceRadiusMeters: 250,
    },
  })
  const maresia = await prisma.company.upsert({
    where: { slug: "restaurante-maresia-e2e" },
    update: { status: "ACTIVE" },
    create: {
      name: "Restaurante Maresia (E2E)",
      slug: "restaurante-maresia-e2e",
      status: "ACTIVE",
      city: "Florianópolis",
      state: "SC",
      latitude: -27.61,
      longitude: -48.48,
      geofenceRadiusMeters: 250,
    },
  })
  console.log(`✓ Empresas: ${pousada.name} (${pousada.id}), ${maresia.name} (${maresia.id})`)

  type Role = "COMPANY_MASTER" | "COMPANY_GERENTE" | "COMPANY_FINANCE" | "EMPLOYEE"
  async function ensureStaff(email: string, name: string, role: Role, companyId: string) {
    const authUser = await createOrGetAuthUser(email)
    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: { name, role, companyId },
      create: { id: authUser.id, email, name, role, companyId },
    })
    if (role === "EMPLOYEE") {
      await prisma.employeeProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
    }
    return user
  }

  const pMaster = await ensureStaff("master@pousada-e2e.teste.com.vc", "Master Pousada Vento Norte", "COMPANY_MASTER", pousada.id)
  const pGerente = await ensureStaff("gerente@pousada-e2e.teste.com.vc", "Gerente Pousada Vento Norte", "COMPANY_GERENTE", pousada.id)
  const pColabA = await ensureStaff("colaboradorA@pousada-e2e.teste.com.vc", "Camareira Fixa (Colab A)", "EMPLOYEE", pousada.id)
  const pColabB = await ensureStaff("colaboradorB@pousada-e2e.teste.com.vc", "Recepcionista (Colab B)", "EMPLOYEE", pousada.id)

  const mMaster = await ensureStaff("master@maresia-e2e.teste.com.vc", "Master Restaurante Maresia", "COMPANY_MASTER", maresia.id)
  const mGerente = await ensureStaff("gerente@maresia-e2e.teste.com.vc", "Gerente Restaurante Maresia", "COMPANY_GERENTE", maresia.id)
  const mColab = await ensureStaff("colaborador@maresia-e2e.teste.com.vc", "Garçom (Colab)", "EMPLOYEE", maresia.id)

  // Setores + horários variados (todas as combinações de configuração de RH pedidas)
  const setorHospedagem = await prisma.sector.upsert({
    where: { companyId_name: { companyId: pousada.id, name: "Hospedagem" } },
    update: {},
    create: { companyId: pousada.id, name: "Hospedagem" },
  })
  const setorRecepcao = await prisma.sector.upsert({
    where: { companyId_name: { companyId: pousada.id, name: "Recepção" } },
    update: {},
    create: { companyId: pousada.id, name: "Recepção" },
  })
  // Colab A: horário único (workStart/End) + folga semanal fixa (domingo)
  await prisma.employeeProfile.update({
    where: { userId: pColabA.id },
    data: { sectorId: setorHospedagem.id, workStartTime: "08:00", workEndTime: "16:00", weeklyDayOff: 0 },
  })
  // Colab B: horário por dia da semana (weeklySchedule) + folga extra mensal
  await prisma.employeeProfile.update({
    where: { userId: pColabB.id },
    data: {
      sectorId: setorRecepcao.id,
      weeklySchedule: {
        MON: { start: "07:00", end: "15:00" },
        TUE: { start: "07:00", end: "15:00" },
        WED: { start: "07:00", end: "15:00" },
        THU: { start: "14:00", end: "22:00" },
        FRI: { start: "14:00", end: "22:00" },
      },
      hasExtraMonthlyDayOff: true,
    },
  })
  console.log("✓ Setores + horários (workStart/End+folga fixa em A, weeklySchedule+folga extra mensal em B)")

  // ===========================================================================
  // FASE B.2 — Checklists de recorrências variadas (DAILY / WEEKLY / MONTHLY)
  // ===========================================================================
  const now = new Date()
  const todayDow = now.getDay()
  const todayDom = now.getDate()

  async function ensureTemplate(title: string, data: Record<string, unknown>) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { companyId: pousada.id, title } })
    if (existing) return prisma.checklistTemplate.update({ where: { id: existing.id }, data: { ...data, companyId: pousada.id, title } as any })
    return prisma.checklistTemplate.create({ data: { ...data, companyId: pousada.id, title } as any })
  }

  const tplDaily = await ensureTemplate("Checklist Diário — Arrumação dos Quartos", {
    recurrence: "DAILY",
    priority: "HIGH",
    dueTime: "18:00",
    createdById: pMaster.id,
    primaryEmployeeId: pColabA.id,
    secondaryEmployeeId: pColabB.id,
  })
  const tplWeekly = await ensureTemplate("Checklist Semanal — Revisão de Enxoval", {
    recurrence: "WEEKLY",
    recurrenceDayOfWeek: todayDow,
    priority: "MEDIUM",
    dueTime: "20:00",
    createdById: pMaster.id,
  })
  const tplMonthly = await ensureTemplate("Checklist Mensal — Inventário de Amenities", {
    recurrence: "MONTHLY",
    recurrenceDayOfMonth: todayDom,
    priority: "LOW",
    dueTime: "22:00",
    createdById: pMaster.id,
  })
  console.log(`✓ Checklists: DAILY, WEEKLY (dia ${todayDow}), MONTHLY (dia ${todayDom})`)

  // ===========================================================================
  // FASE B.3 — login como todo o elenco novo
  // ===========================================================================
  const P = {
    master: await loginAs(pMaster.email),
    gerente: await loginAs(pGerente.email),
    colabA: await loginAs(pColabA.email),
    colabB: await loginAs(pColabB.email),
  }
  const M = {
    master: await loginAs(mMaster.email),
    gerente: await loginAs(mGerente.email),
    colab: await loginAs(mColab.email),
  }
  console.log("✓ Sessões autenticadas para as 2 empresas novas")

  await check("B.Checklists", "Criação de templates DAILY/WEEKLY/MONTHLY funcionou", async () => {
    const { status, json } = await api(P.master, "GET", "/api/company/checklists/templates")
    if (status !== 200) return `status ${status}`
    const titles = json.map((t: any) => t.title)
    return (
      (titles.includes(tplDaily.title) && titles.includes(tplWeekly.title) && titles.includes(tplMonthly.title)) ||
      `templates ausentes: ${JSON.stringify(titles)}`
    )
  })

  // ===========================================================================
  // FASE C — matriz de variações do Programa de Parceria (via PUT real)
  // ===========================================================================
  console.log("\n--- FASE C: variações de Programa de Parceria ---")

  await check("C.Programa", "PRODUCT_UNIT sem productUnitLabel é rejeitado (400)", async () => {
    const { status } = await api(P.master, "PUT", "/api/company/program", {
      name: "Programa Pousada Vento Norte",
      commissionValue: 1,
      commissionFormat: "PRODUCT_UNIT",
    })
    return status === 400 || `esperado 400, veio ${status}`
  })

  await check("C.Programa", "PRODUCT_UNIT com label -> commissionType derivado = FIXED", async () => {
    const { status, json } = await api(P.master, "PUT", "/api/company/program", {
      name: "Programa Pousada Vento Norte",
      commissionValue: 1,
      commissionFormat: "PRODUCT_UNIT",
      productUnitLabel: "1 diária grátis",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.commissionType === "FIXED" || `esperado FIXED, veio ${json.commissionType}`
  })

  await check("C.Programa", "PERCENTAGE + fixedValue -> commissionType derivado = BOTH", async () => {
    const { status, json } = await api(P.master, "PUT", "/api/company/program", {
      name: "Programa Pousada Vento Norte",
      commissionValue: 10,
      commissionFormat: "PERCENTAGE",
      fixedValue: 15,
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.commissionType === "BOTH" || `esperado BOTH, veio ${json.commissionType}`
  })

  await check("C.Programa", "FIXED_VALUE -> commissionType derivado = FIXED", async () => {
    const { status, json } = await api(P.master, "PUT", "/api/company/program", {
      name: "Programa Pousada Vento Norte",
      commissionValue: 40,
      commissionFormat: "FIXED_VALUE",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.commissionType === "FIXED" || `esperado FIXED, veio ${json.commissionType}`
  })

  // Configuração final (usada nas fases seguintes): % simples, sem fixedValue -> VARIABLE
  await check("C.Programa", "Configuração final PERCENTAGE simples -> VARIABLE", async () => {
    const { status, json } = await api(P.master, "PUT", "/api/company/program", {
      name: "Programa Pousada Vento Norte",
      description: "Indique hóspedes e ganhe comissão",
      commissionValue: 10,
      commissionFormat: "PERCENTAGE",
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.commissionType === "VARIABLE" || `esperado VARIABLE, veio ${json.commissionType}`
  })

  // Programa da Maresia: comissão fixa simples, sem níveis (contraste com o da Pousada)
  await check("C.Programa", "Restaurante Maresia — programa FIXED_VALUE simples", async () => {
    const { status, json } = await api(M.master, "PUT", "/api/company/program", {
      name: "Programa Restaurante Maresia",
      description: "R$25 fixos por indicação convertida",
      commissionValue: 25,
      commissionFormat: "FIXED_VALUE",
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return json.commissionType === "FIXED" || `esperado FIXED, veio ${json.commissionType}`
  })

  // ===========================================================================
  // FASE D — Níveis do Programa (todos os critérios) + sincronização de hasLevels
  // ===========================================================================
  console.log("\n--- FASE D: níveis do programa + progressão real de um parceiro ---")

  const pousadaProgram = await prisma.program.findUniqueOrThrow({ where: { companyId: pousada.id } })

  // Limpa níveis de corridas anteriores (idempotência)
  await prisma.programLevel.deleteMany({ where: { programId: pousadaProgram.id } })

  const levelDefs = [
    { name: "Bronze", criteria: "REFERRAL_COUNT", requiredReferralCount: 0, measurementUnit: "ALL_TIME", benefitType: "PERCENTAGE", commissionPercentage: 10, medalIcon: "BRONZE" },
    { name: "Prata", criteria: "REFERRAL_COUNT", requiredReferralCount: 3, measurementUnit: "MONTHS", periodMonths: 3, benefitType: "FIXED", bonusFixedAmount: 50, medalIcon: "SILVER" },
    { name: "Ouro", criteria: "REVENUE", requiredRevenueAmount: 1000, measurementUnit: "ALL_TIME", benefitType: "BOTH", commissionPercentage: 15, bonusFixedAmount: 30, medalIcon: "GOLD" },
    { name: "Diamante", criteria: "BOTH", requiredReferralCount: 10, requiredRevenueAmount: 5000, measurementUnit: "ALL_TIME", benefitType: "PERCENTAGE", commissionPercentage: 20, medalIcon: "DIAMOND" },
  ]
  for (const lvl of levelDefs) {
    await check("D.Niveis", `Cria nível "${lvl.name}" (criteria=${lvl.criteria}, benefitType=${lvl.benefitType})`, async () => {
      const { status, json } = await api(P.master, "POST", "/api/company/program/levels", lvl)
      if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
      return true
    })
  }

  await check("D.Niveis", "Program.hasLevels sincroniza para true após criar níveis (fix aplicado)", async () => {
    const { status, json } = await api(P.master, "GET", "/api/company/program")
    if (status !== 200) return `status ${status}`
    return json.hasLevels === true || `hasLevels ficou ${json.hasLevels}`
  })

  // Parceiro dedicado para o teste de progressão
  const progressPartnerEmail = "parceiro.progressao-e2e@teste.com.vc"
  const progressAuthUser = await createOrGetAuthUser(progressPartnerEmail)
  const progressPartner = await prisma.user.upsert({
    where: { id: progressAuthUser.id },
    update: { role: "PARTNER" },
    create: { id: progressAuthUser.id, email: progressPartnerEmail, name: "Parceiro Progressão E2E", role: "PARTNER" },
  })
  await prisma.partnerProfile.upsert({
    where: { userId: progressPartner.id },
    update: { cpf: randomValidCpf(), pixKey: "progressao-e2e@teste.com.vc" },
    create: { userId: progressPartner.id, partnerType: "INDIVIDUAL", cpf: randomValidCpf(), pixKey: "progressao-e2e@teste.com.vc" },
  })
  const progressSession = await loginAs(progressPartnerEmail)

  await check("D.Progressao", "Parceiro adere ao Programa da Pousada", async () => {
    const { status } = await api(progressSession, "POST", `/api/partner/programs/${pousadaProgram.id}/join`)
    return status === 201 || `status ${status}`
  })

  // Idempotência: zera as indicações de progressão de corridas anteriores —
  // sem isso, rodar o script 2x no mesmo dia já deixaria o parceiro acima de
  // Bronze antes mesmo do teste começar.
  await prisma.commission.deleteMany({
    where: { partnerId: progressPartner.id, companyId: pousada.id, clientName: { startsWith: "Hóspede Progressão" } },
  })

  await check("D.Progressao", "Nível inicial = Bronze (0 indicações já atende REFERRAL_COUNT>=0)", async () => {
    const { status, json } = await api(progressSession, "GET", "/api/partner/nivel-por-programa")
    if (status !== 200) return `status ${status}`
    const entry = json.find((p: any) => p.programId === pousadaProgram.id)
    if (!entry) return "programa não apareceu em nivel-por-programa"
    return entry.currentLevel?.name === "Bronze" || `currentLevel = ${JSON.stringify(entry.currentLevel)}`
  })

  // 3 comissões aprovadas de R$400 (amount) cada — soma R$1200 de faturamento e
  // 3 indicações: atinge Prata (3 indicações) E o critério de receita do Ouro
  // (>=R$1000) ao mesmo tempo; Diamante (10 indicações) fica fora de alcance.
  for (let i = 0; i < 3; i++) {
    await check("D.Progressao", `Comissão aprovada #${i + 1} (indicação convertida, R$400)`, async () => {
      const form = new FormData()
      form.set("partnerId", progressPartner.id)
      form.set("clientName", `Hóspede Progressão ${i + 1}`)
      form.set("customerPhone", `85999${Date.now().toString().slice(-6)}${i}`)
      form.set("amount", "400")
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comanda.jpg", { type: "image/jpeg" })
      form.set("file", file)
      const created = await api(P.colabA, "POST", "/api/commissions", form, true)
      if (created.status !== 201) return `criação status ${created.status} — ${JSON.stringify(created.json)}`

      const approved = await api(P.master, "PATCH", `/api/company/finance/commissions/${created.json.id}`, { status: "APPROVED" })
      if (approved.status !== 200) return `aprovação status ${approved.status} — ${JSON.stringify(approved.json)}`
      return true
    })
  }

  await check("D.Progressao", "Após 3 indicações aprovadas (R$1200): nível = Ouro, próximo = Diamante", async () => {
    const { status, json } = await api(progressSession, "GET", "/api/partner/nivel-por-programa")
    if (status !== 200) return `status ${status}`
    const entry = json.find((p: any) => p.programId === pousadaProgram.id)
    if (!entry) return "programa não apareceu"
    if (entry.currentLevel?.name !== "Ouro") return `currentLevel = ${JSON.stringify(entry.currentLevel)} (esperado Ouro)`
    if (entry.nextLevel?.name !== "Diamante") return `nextLevel = ${JSON.stringify(entry.nextLevel)} (esperado Diamante)`
    return true
  })

  // ===========================================================================
  // FASE E — matriz de variações de Promoção + esgotamento de estoque
  // ===========================================================================
  console.log("\n--- FASE E: variações de Promoção + esgotamento de estoque ---")

  const validFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const validUntil = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  let promoDiscountPercent: any, promoDiscountPrice: any, promoFreeGift: any, promoDoubleBenefit: any, promoCashCreditInternal: any

  // Idempotência: reaproveita a promoção já criada em uma corrida anterior (por
  // título) em vez de duplicar a cada execução — só falta mesmo criar na 1ª vez.
  async function ensurePromotion(name: string, title: string, data: Record<string, unknown>) {
    await check("E.Promocao", name, async () => {
      const existing = await prisma.promotion.findFirst({ where: { companyId: maresia.id, title } })
      if (existing) return true
      const { status, json } = await api(M.master, "POST", "/api/company/promotions", { title, ...data })
      if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
      return true
    })
    return prisma.promotion.findFirst({ where: { companyId: maresia.id, title } })
  }

  promoDiscountPercent = await ensurePromotion("DISCOUNT por percentual, com estoque limitado (2)", "20% OFF no Jantar (E2E)", {
    description: "fixture",
    offerType: "DISCOUNT",
    discountPercentage: 20,
    validFrom,
    validUntil,
    cost: 0,
    stock: 2,
    audience: "EXTERNAL",
  })
  // Reseta o estoque consumido — garante que o teste de esgotamento abaixo seja
  // determinístico mesmo reaproveitando a mesma promoção entre corridas.
  promoDiscountPercent = await prisma.promotion.update({ where: { id: promoDiscountPercent.id }, data: { usedCount: 0, active: true } })

  promoDiscountPrice = await ensurePromotion("DISCOUNT por de-para de preço (originalPrice/discountedPrice)", "Prato do dia de R$60 por R$45 (E2E)", {
    description: "fixture",
    offerType: "DISCOUNT",
    originalPrice: 60,
    discountedPrice: 45,
    validFrom,
    validUntil,
    cost: 0,
    audience: "EXTERNAL",
  })

  promoFreeGift = await ensurePromotion("FREE_GIFT (brinde grátis)", "Sobremesa grátis (E2E)", {
    description: "fixture",
    offerType: "FREE_GIFT",
    validFrom,
    validUntil,
    cost: 0,
    audience: "EXTERNAL",
  })

  promoDoubleBenefit = await ensurePromotion("DOUBLE_BENEFIT (\"pediu 1, levou 2\")", "Pediu 1 caipirinha, levou 2 (E2E)", {
    description: "fixture",
    offerType: "DOUBLE_BENEFIT",
    validFrom,
    validUntil,
    cost: 0,
    audience: "EXTERNAL",
  })

  await check("E.Promocao", "CASH_CREDIT sem creditAmount é rejeitado (400)", async () => {
    const { status } = await api(M.master, "POST", "/api/company/promotions", {
      title: "Crédito na comanda (E2E, inválida)",
      description: "fixture",
      offerType: "CASH_CREDIT",
      validFrom,
      validUntil,
      cost: 0,
      audience: "INTERNAL",
    })
    return status === 400 || `esperado 400, veio ${status}`
  })

  promoCashCreditInternal = await ensurePromotion("CASH_CREDIT com creditAmount, audience INTERNAL (Vale Retorno)", "R$20 de crédito na volta (E2E)", {
    description: "fixture",
    offerType: "CASH_CREDIT",
    creditAmount: 20,
    validFrom,
    validUntil,
    cost: 0,
    audience: "INTERNAL",
  })

  await check("E.Promocao", "Descobrir Promo (parceiro) mostra as 4 EXTERNAL, NÃO mostra a INTERNAL", async () => {
    const { status, json } = await api(progressSession, "GET", "/api/partner/discover-promotions")
    if (status !== 200) return `status ${status}`
    const ids = json.map((p: any) => p.id)
    const hasAllExternal = [promoDiscountPercent.id, promoDiscountPrice.id, promoFreeGift.id, promoDoubleBenefit.id].every((id) => ids.includes(id))
    const leaksInternal = ids.includes(promoCashCreditInternal.id)
    if (!hasAllExternal) return `faltam promoções EXTERNAL na vitrine — ids: ${JSON.stringify(ids)}`
    if (leaksInternal) return "promoção INTERNAL vazou para a vitrine pública do parceiro"
    return true
  })

  // Esgotamento de estoque: a promo tem stock=2 — 2 resgates OK, o 3º deve ser
  // bloqueado. Cada resgate usa um telefone de cliente DIFERENTE — o mesmo
  // telefone reutilizado em menos de 90 dias dispara o cooldown antiabuso
  // (ver app/api/commissions/route.ts), que é uma regra separada do estoque.
  async function redeemStockPromo(partnerId: string, clientName: string, phone: string) {
    const form = new FormData()
    form.set("promotionId", promoDiscountPercent.id)
    form.set("partnerId", partnerId)
    form.set("clientName", clientName)
    form.set("customerPhone", phone)
    form.set("amount", "50")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comanda.jpg", { type: "image/jpeg" })
    form.set("file", file)
    return api(M.colab, "POST", "/api/commissions", form, true)
  }
  // Telefones com sufixo do timestamp da corrida — o cooldown antiabuso é por
  // telefone+90 dias, então reusar um telefone fixo entre corridas do MESMO
  // dia dispararia o cooldown em vez de testar o estoque.
  const stockRunSuffix = Date.now().toString().slice(-6)
  await check("E.Estoque", "1º resgate da promoção com estoque=2 é aceito", async () => {
    const r = await redeemStockPromo(progressPartner.id, "Cliente Estoque 1", `8599${stockRunSuffix}1`)
    if (r.status !== 201) return `status ${r.status} — ${JSON.stringify(r.json)}`
    return true
  })
  await check("E.Estoque", "2º resgate (esgota o estoque) é aceito", async () => {
    const r = await redeemStockPromo(progressPartner.id, "Cliente Estoque 2", `8599${stockRunSuffix}2`)
    if (r.status !== 201) return `status ${r.status} — ${JSON.stringify(r.json)}`
    return true
  })
  await check("E.Estoque", "3º resgate é bloqueado — estoque esgotado (400)", async () => {
    const form = new FormData()
    form.set("promotionId", promoDiscountPercent.id)
    form.set("partnerId", progressPartner.id)
    form.set("clientName", "Cliente Estoque 3")
    form.set("customerPhone", `8599${stockRunSuffix}3`)
    form.set("amount", "50")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comanda.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status, json } = await api(M.colab, "POST", "/api/commissions", form, true)
    if (status !== 400) return `esperado 400 (sem estoque), veio ${status} — ${JSON.stringify(json)}`
    return true
  })

  // ===========================================================================
  // FASE F — Fechamento de Caixa: os 3 passos obrigatórios, de ponta a ponta
  // ===========================================================================
  console.log("\n--- FASE F: Fechamento de Caixa (3 passos) ---")

  // Idempotência: ShiftClosing é 1 por empresa/dia — sem resetar, rodar a
  // suíte 2x no mesmo dia encontraria o fechamento de hoje já COMPLETED de
  // uma corrida anterior e travaria os passos 1/2/3 com 403 em vez de testá-los.
  await prisma.shiftClosing.deleteMany({ where: { companyId: maresia.id, date: startOfDay() } })
  await prisma.dailyEvaluation.deleteMany({ where: { companyId: maresia.id, date: startOfDay() } })

  await check("F.Fechamento", "Colaborador da Maresia bate CHECK_IN (necessário p/ nota diária)", async () => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: maresia.id } })
    await prisma.timeEntry.deleteMany({ where: { userId: mColab.id, companyId: maresia.id, createdAt: { gte: startOfDay() } } })
    const { status, json } = await api(M.colab, "POST", "/api/company/timeclock", {
      type: "CHECK_IN",
      latitude: Number(company.latitude),
      longitude: Number(company.longitude),
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  // Cria uma Commission SEM amount (simula o registro antigo que o passo 1 do
  // fechamento precisa completar) diretamente via Prisma — o Scanner PDV atual
  // sempre exige o valor na hora, então isso só existe como pendência legada.
  // Idempotência: reaproveita (com amount resetado p/ null) se já existe uma
  // de hoje de uma corrida anterior, em vez de empilhar pendências novas.
  const existingPendingCommission = await prisma.commission.findFirst({
    where: { companyId: maresia.id, clientName: "Cliente Sem Valor Ainda (E2E)", date: { gte: startOfDay() } },
  })
  const pendingCommission = existingPendingCommission
    ? await prisma.commission.update({ where: { id: existingPendingCommission.id }, data: { amount: null } })
    : await prisma.commission.create({
        data: {
          companyId: maresia.id,
          partnerId: progressPartner.id,
          clientName: "Cliente Sem Valor Ainda (E2E)",
          customerPhone: "85990001111",
          scannedById: mColab.id,
      status: "PENDING",
      amount: null,
    },
  })

  await check("F.Fechamento", "Passo 3 bloqueado enquanto há indicação sem Valor da Conta (passo 1 pendente)", async () => {
    const form = new FormData()
    form.set("revenueAmount", "500")
    const { status, json } = await api(M.gerente, "POST", "/api/company/shift-closing", form, true)
    if (status !== 400) return `esperado 400, veio ${status} — ${JSON.stringify(json)}`
    return String(json.error).toLowerCase().includes("valor da conta") || `mensagem inesperada: ${json.error}`
  })

  await check("F.Fechamento", "Passo 1 — Gerente preenche o Valor da Conta pendente", async () => {
    const { status } = await api(M.gerente, "PATCH", `/api/company/shift-closing/commissions/${pendingCommission.id}`, { amount: 180 })
    return status === 200 || `status ${status}`
  })

  await check("F.Fechamento", "Passo 3 ainda bloqueado — falta a nota diária do colaborador presente (passo 2)", async () => {
    const form = new FormData()
    form.set("revenueAmount", "500")
    const { status, json } = await api(M.gerente, "POST", "/api/company/shift-closing", form, true)
    if (status !== 400) return `esperado 400, veio ${status} — ${JSON.stringify(json)}`
    return String(json.error).includes("colaboradores presentes") || `mensagem inesperada: ${json.error}`
  })

  await check("F.Fechamento", "Passo 2 — Gerente lança a nota diária do colaborador presente", async () => {
    const { status } = await api(M.gerente, "POST", "/api/company/evaluations", { employeeId: mColab.id, score: 1 })
    return status === 201 || `status ${status}`
  })

  await check("F.Fechamento", "Passo 3 — Gerente finaliza o expediente (faturamento + comprovante)", async () => {
    const form = new FormData()
    form.set("revenueAmount", "680")
    form.set("summary", "Fechamento de teste automatizado")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comprovante.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status, json } = await api(M.gerente, "POST", "/api/company/shift-closing", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    return json.status === "COMPLETED" || `status do fechamento = ${json.status}`
  })

  await check("F.Fechamento", "Gerente NÃO pode mais editar o fechamento já COMPLETED (403)", async () => {
    const form = new FormData()
    form.set("revenueAmount", "999")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comprovante2.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status } = await api(M.gerente, "POST", "/api/company/shift-closing", form, true)
    return status === 403 || `esperado 403, veio ${status}`
  })

  await check("F.Fechamento", "Master CONSEGUE corrigir o fechamento já COMPLETED (isMasterOverride)", async () => {
    const form = new FormData()
    form.set("revenueAmount", "700")
    form.set("summary", "Correção do Master")
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "comprovante3.jpg", { type: "image/jpeg" })
    form.set("file", file)
    const { status, json } = await api(M.master, "POST", "/api/company/shift-closing", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    return json.isMasterOverride === true || `isMasterOverride = ${json.isMasterOverride}`
  })

  // Ocorrência de hoje — o dia JÁ tem fechamento COMPLETED (testes acima) —
  // a Gerente não deve mais poder editar/excluir, só o Master.
  let lockedOccurrenceId = ""
  await check("F.Fechamento", "Ocorrência de um dia já fechado — Gerente NÃO pode editar/excluir (403)", async () => {
    const createForm = new FormData()
    createForm.set("employeeId", mColab.id)
    createForm.set("type", "VALE")
    createForm.set("value", "20")
    const created = await api(M.master, "POST", "/api/company/occurrences", createForm, true)
    if (created.status !== 201) return `criação falhou: status ${created.status} — ${JSON.stringify(created.json)}`
    lockedOccurrenceId = created.json.id

    const patch = await api(M.gerente, "PATCH", `/api/company/occurrences/${lockedOccurrenceId}`, { description: "tentativa indevida" })
    if (patch.status !== 403) return `PATCH: esperado 403, veio ${patch.status}`
    const del = await api(M.gerente, "DELETE", `/api/company/occurrences/${lockedOccurrenceId}`)
    if (del.status !== 403) return `DELETE: esperado 403, veio ${del.status}`
    return true
  })

  await check("F.Fechamento", "Mesma ocorrência — Master CONSEGUE editar e excluir mesmo com o dia fechado", async () => {
    const patch = await api(M.master, "PATCH", `/api/company/occurrences/${lockedOccurrenceId}`, { description: "correção do Master" })
    if (patch.status !== 200) return `PATCH: esperado 200, veio ${patch.status}`
    const del = await api(M.master, "DELETE", `/api/company/occurrences/${lockedOccurrenceId}`)
    if (del.status !== 200) return `DELETE: esperado 200, veio ${del.status}`
    return true
  })

  // ===========================================================================
  // FASE G — Escalonamento de Checklist (ausência do responsável)
  // ===========================================================================
  console.log("\n--- FASE G: escalonamento de checklist por ausência ---")

  // Cenário 1: principal (Colab A) ausente hoje, secundário (Colab B) presente
  // -> a tarefa deve ser automaticamente reatribuída ao secundário.
  await prisma.timeEntry.deleteMany({ where: { companyId: pousada.id, createdAt: { gte: startOfDay() } } })
  await check("G.Escalonamento", "Colaborador B (secundário) bate ponto — fica 'presente' hoje", async () => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: pousada.id } })
    const { status } = await api(P.colabB, "POST", "/api/company/timeclock", {
      type: "CHECK_IN",
      latitude: Number(company.latitude),
      longitude: Number(company.longitude),
    })
    return status === 201 || `status ${status}`
  })

  // Remove a instância de hoje do template DAILY criado na Fase B, se já existir
  // de uma corrida anterior (idempotência), para o ensureTodayChecklistInstances rodar de novo.
  await prisma.checklist.deleteMany({ where: { templateId: tplDaily.id, forDate: startOfDay() } })

  await check("G.Escalonamento", "Principal ausente + secundário presente -> tarefa cai pro secundário (isAutoReassigned)", async () => {
    const { status, json } = await api(P.gerente, "GET", "/api/company/checklists?scope=team")
    if (status !== 200) return `status ${status}`
    const instance = json.checklists.find((c: any) => c.templateId === tplDaily.id && c.forDate?.startsWith(startOfDay().toISOString().slice(0, 10)))
    if (!instance) return `instância de hoje do template DAILY não foi criada — checklists: ${JSON.stringify(json.checklists.map((c: any) => c.templateId))}`
    if (instance.employee.id !== pColabB.id) return `caiu para ${instance.employee.id}, esperado o secundário ${pColabB.id}`
    return instance.isAutoReassigned === true || "isAutoReassigned deveria ser true"
  })

  // Cenário 2: principal E secundário ausentes -> cai para Master/Gerente.
  const tplDaily2 = await ensureTemplate("Checklist Diário 2 — Conferência de Chaves (E2E)", {
    recurrence: "DAILY",
    priority: "HIGH",
    dueTime: "19:00",
    createdById: pMaster.id,
    primaryEmployeeId: pColabA.id,
    secondaryEmployeeId: pColabB.id,
  })
  // Marca os dois como INACTIVE temporariamente só para simular ausência sem
  // depender de ponto — revertido logo depois do check. Remove qualquer
  // instância de hoje criada ANTES desta marcação (o GET do Cenário 1 já
  // varre TODOS os templates DAILY da empresa de uma vez, então este template
  // também ganharia uma instância — corretamente reatribuída ao Colab B, que
  // até então ainda estava ativo/presente).
  await prisma.user.updateMany({ where: { id: { in: [pColabA.id, pColabB.id] } }, data: { status: "INACTIVE" } })
  await prisma.checklist.deleteMany({ where: { templateId: tplDaily2.id, forDate: startOfDay() } })
  await check("G.Escalonamento", "Principal E secundário ausentes -> tarefa cai para Master/Gerente", async () => {
    const { status, json } = await api(P.gerente, "GET", "/api/company/checklists?scope=team")
    if (status !== 200) return `status ${status}`
    const instance = json.checklists.find((c: any) => c.templateId === tplDaily2.id)
    if (!instance) return "instância do 2º template DAILY não foi criada"
    const fellToManager = instance.employee.id === pMaster.id || instance.employee.id === pGerente.id
    return fellToManager || `caiu para ${JSON.stringify(instance.employee)}, esperado Master ou Gerente`
  })
  await prisma.user.updateMany({ where: { id: { in: [pColabA.id, pColabB.id] } }, data: { status: "ACTIVE" } })
  console.log("✓ Revertido: Colaboradores A e B voltaram para status ACTIVE")

  // ===========================================================================
  // FASE H — dashboards do Admin, CEP, mapas do parceiro (smoke tests)
  // ===========================================================================
  console.log("\n--- FASE H: dashboards, CEP e mapas ---")

  await check("H.Admin", "Dashboard financeiro SaaS (MRR/churn/projeção 6 meses)", async () => {
    const { status, json } = await api(admin, "GET", "/api/admin/finance/saas-summary")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json.projection) && json.projection.length === 6 ? true : `projection = ${JSON.stringify(json.projection)}`
  })

  await check("H.Admin", "Dashboard geral do Admin responde", async () => {
    const { status } = await api(admin, "GET", "/api/admin/dashboard")
    return status === 200 || `status ${status}`
  })

  await check("H.Geo", "Busca de CEP válido (Av. Paulista) devolve endereço", async () => {
    const { status, json } = await api(P.master, "GET", "/api/company/geo/cep?cep=01310-100")
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return typeof json.city === "string" || typeof json.street === "string" || `resposta inesperada: ${JSON.stringify(json)}`
  })

  await check("H.Geo", "CEP com formato inválido é rejeitado (400)", async () => {
    const { status } = await api(P.master, "GET", "/api/company/geo/cep?cep=abc")
    return status === 400 || `esperado 400, veio ${status}`
  })

  await check("H.Mapas", "Mapa de programas do parceiro inclui a Pousada Vento Norte", async () => {
    const { status, json } = await api(progressSession, "GET", "/api/partner/programs-map")
    if (status !== 200) return `status ${status}`
    return json.some((c: any) => c.id === pousada.id) || "Pousada Vento Norte não apareceu no mapa"
  })

  await check("H.Carteira", "Wallet-by-company do parceiro mostra saldo disponível na Pousada", async () => {
    const { status, json } = await api(progressSession, "GET", "/api/partner/wallet-by-company")
    if (status !== 200) return `status ${status}`
    const row = json.find((r: any) => r.companyId === pousada.id)
    if (!row) return "Pousada Vento Norte não apareceu na carteira por empresa"
    return row.availableBalance > 0 || `availableBalance = ${row.availableBalance}`
  })

  // ===========================================================================
  printSummary("RESULTADO FINAL — VARIAÇÕES E PENDÊNCIAS")
  await prisma.$disconnect()
  process.exit(results.some((r) => !r.pass) ? 1 : 0)
}

main().catch((e) => {
  console.error("ERRO FATAL NA AUDITORIA:", e)
  process.exit(1)
})
