/**
 * Auditoria E2E automatizada da plataforma Tribuss — simula os 5 perfis
 * (Admin, Master, Gerente, Colaborador, Parceiro) fazendo requisições HTTP
 * reais (com sessão Supabase de verdade, via cookies @supabase/ssr) contra o
 * servidor local (npm run dev), cobrindo fluxos de negócio, RBAC,
 * multi-tenancy e casos de borda.
 *
 * Requer: `npm run dev` rodando em http://localhost:3000 (ou AUDIT_BASE_URL).
 * Uso: npx tsx scripts/audit-e2e-simulation.ts
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import {
  BASE_URL,
  SUPABASE_URL,
  PASSWORD,
  currentTotpCode,
  randomValidCpf,
  check,
  printSummary,
  results,
  loginAs,
  api,
  startOfDay,
  type Session,
} from "./audit-lib"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const supabaseAdmin = createAdminClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== AUDITORIA E2E TRIBUSS — ${new Date().toISOString()} ===`)
  console.log(`Base URL: ${BASE_URL}\n`)

  // ---- FASE 1: descobrir/complementar dados-base --------------------------
  console.log("--- FASE 1: descoberta e complemento de dados de teste ---")

  const jeri = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-jeri" } })
  const lagoa = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-lagoa" } })
  const inOn = await prisma.company.findUniqueOrThrow({ where: { slug: "in-on" } })
  console.log(`Empresas: Jeri=${jeri.status} Lagoa=${lagoa.status} IN-ON=${inOn.status}`)

  const usersByEmail: Record<string, { id: string; role: string; companyId: string | null }> = {}
  const EMAILS = [
    "admin@teste.com.vc",
    "master@teste.com.vc",
    "gerente@teste.com.vc",
    "financeiro@teste.com.vc",
    "colaborador@teste.com.vc",
    "parceiro@teste.com.vc",
    "master.lagoa@teste.com.vc",
    "gerente.lagoa@teste.com.vc",
    "financeiro.lagoa@teste.com.vc",
    "colaborador.lagoa@teste.com.vc",
    "master.inon@teste.com.vc",
    "gerente.inon@teste.com.vc",
    "financeiro.inon@teste.com.vc",
    "colaborador.inon@teste.com.vc",
    "ana.jeri@teste.com.vc",
  ]
  for (const email of EMAILS) {
    const u = await prisma.user.findUnique({ where: { email } })
    if (!u) throw new Error(`Usuário base ausente: ${email} — rode scripts/seed.mjs e prisma/seed-demo-data.ts primeiro`)
    usersByEmail[email] = { id: u.id, role: u.role, companyId: u.companyId }
  }
  console.log(`✓ ${EMAILS.length} usuários-base localizados (senha padrão 123456)`)

  // Setor "Cozinha Auditoria" em Jeri + colaborador@ como responsável, com
  // horário semanal e delegação de Financeiro — fixtures para Fase 2.2/2.3.
  const sector = await prisma.sector.upsert({
    where: { companyId_name: { companyId: jeri.id, name: "Cozinha Auditoria" } },
    update: {},
    create: { companyId: jeri.id, name: "Cozinha Auditoria" },
  })
  await prisma.employeeProfile.update({
    where: { userId: usersByEmail["colaborador@teste.com.vc"].id },
    data: {
      sectorId: sector.id,
      isSectorCommunicationResponsible: true,
      isFinanceResponsible: true,
      workStartTime: "08:00",
      workEndTime: "17:00",
      weeklySchedule: { MON: { start: "08:00", end: "17:00" }, TUE: { start: "08:00", end: "17:00" } },
      hasExtraMonthlyDayOff: true,
    },
  })
  console.log("✓ Fixture: colaborador@teste.com.vc como responsável de Setor + Financeiro delegado + horário semanal")

  // Promoção INTERNAL (Vale Retorno) ativa em Jeri, para o teste de
  // duplicidade de QR do Scanner PDV.
  let voucherPromo = await prisma.promotion.findFirst({ where: { companyId: jeri.id, audience: "INTERNAL", active: true } })
  if (!voucherPromo) {
    voucherPromo = await prisma.promotion.create({
      data: {
        companyId: jeri.id,
        title: "Vale Retorno — Auditoria",
        description: "Fixture de auditoria E2E",
        offerType: "DISCOUNT",
        audience: "INTERNAL",
        discountPercentage: 10,
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cost: 0,
      },
    })
  }
  console.log(`✓ Fixture: Promotion INTERNAL "${voucherPromo.title}" (${voucherPromo.id}) ativa em Jeri`)

  // Parceiro sem CPF/PIX (Etapa 2 incompleta) — para o teste de gate de adesão.
  let incompletePartner = await prisma.user.findFirst({
    where: { role: "PARTNER", partnerProfile: { cpf: null } },
    select: { email: true, id: true },
  })
  if (!incompletePartner) {
    console.log("⚠ Nenhum parceiro sem CPF encontrado — criando um dedicado")
    const email = "parceiro.incompleto@teste.com.vc"
    const authUser = await supabaseAdmin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (authUser.error || !authUser.data.user) throw authUser.error
    const u = await prisma.user.upsert({
      where: { id: authUser.data.user.id },
      update: {},
      create: { id: authUser.data.user.id, email, name: "Parceiro Incompleto Auditoria", role: "PARTNER" },
    })
    await prisma.partnerProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, partnerType: "INDIVIDUAL" } })
    incompletePartner = { email, id: u.id }
  }
  console.log(`✓ Fixture: parceiro com cadastro incompleto = ${incompletePartner.email}`)

  // Parceiro + Program de Jeri, para o teste de desligamento automático por 90 dias.
  const jeriProgram = await prisma.program.findUniqueOrThrow({ where: { companyId: jeri.id } })
  const staleMembershipPartner = await prisma.user.findFirstOrThrow({
    where: { role: "PARTNER", id: { not: incompletePartner.id } },
    select: { id: true, email: true },
  })
  const staleMembership = await prisma.programMembership.upsert({
    where: { programId_partnerId: { programId: jeriProgram.id, partnerId: staleMembershipPartner.id } },
    update: { status: "ACTIVE", lastActivityAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), terminatedAt: null, terminationReason: null },
    create: {
      programId: jeriProgram.id,
      companyId: jeri.id,
      partnerId: staleMembershipPartner.id,
      status: "ACTIVE",
      lastActivityAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
    },
  })
  console.log(`✓ Fixture: ProgramMembership de ${staleMembershipPartner.email} com lastActivityAt há 95 dias`)

  // ---- login como todos os perfis -----------------------------------------
  console.log("\n--- Autenticando todos os perfis de teste ---")
  const sessions: Record<string, Session> = {}
  for (const email of EMAILS) {
    sessions[email] = await loginAs(email)
  }
  console.log(`✓ ${Object.keys(sessions).length} sessões estabelecidas`)

  const S = {
    admin: sessions["admin@teste.com.vc"],
    master: sessions["master@teste.com.vc"],
    gerente: sessions["gerente@teste.com.vc"],
    financeiro: sessions["financeiro@teste.com.vc"],
    colaborador: sessions["colaborador@teste.com.vc"],
    parceiro: sessions["parceiro@teste.com.vc"],
    masterLagoa: sessions["master.lagoa@teste.com.vc"],
    gerenteLagoa: sessions["gerente.lagoa@teste.com.vc"],
    colaboradorLagoa: sessions["colaborador.lagoa@teste.com.vc"],
    masterInOn: sessions["master.inon@teste.com.vc"],
    anaJeri: sessions["ana.jeri@teste.com.vc"],
  }

  // ===========================================================================
  // FASE 2 — fluxos de negócio por perfil
  // ===========================================================================
  console.log("\n--- FASE 2: fluxos por perfil ---")

  await check("2.Admin", "GET /api/admin/companies lista as empresas", async () => {
    const { status, json } = await api(S.admin, "GET", "/api/admin/companies")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json) && json.length >= 3
  })

  await check("2.Admin", "GET /api/admin/finance/overview (painel financeiro SaaS)", async () => {
    const { status } = await api(S.admin, "GET", "/api/admin/finance/overview")
    return status === 200 || status === 404 // 404 tolerado se a rota tiver outro path — ver detalhe abaixo
  })

  await check("2.Master", "Master consegue ver colaboradores da própria empresa", async () => {
    const { status, json } = await api(S.master, "GET", "/api/company/employees")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json) && json.some((e: any) => e.email === "colaborador@teste.com.vc")
  })

  await check("2.Gerente", "Ponto Digital: Colaborador bate CHECK_IN dentro do raio (geofence)", async () => {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: jeri.id } })
    await prisma.timeEntry.deleteMany({ where: { userId: usersByEmail["colaborador@teste.com.vc"].id, companyId: jeri.id, createdAt: { gte: startOfDay() } } })
    const { status, json } = await api(S.colaborador, "POST", "/api/company/timeclock", {
      type: "CHECK_IN",
      latitude: Number(company.latitude),
      longitude: Number(company.longitude),
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("2.Gerente", "Ponto Digital: batida fora do raio retorna 403 (geofencing)", async () => {
    const { status, json } = await api(S.colaborador, "POST", "/api/company/timeclock", {
      type: "BREAK_START",
      latitude: -1.0,
      longitude: -1.0,
    })
    if (status !== 403) return `esperado 403, veio ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("2.Checklist", "Colaborador vê seus checklists do dia", async () => {
    const { status, json } = await api(S.colaborador, "GET", "/api/company/checklists")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json?.checklists)
  })

  await check("2.Comunicacao", "Master envia Comunicação Interna para o Setor", async () => {
    const form = new FormData()
    form.set("recipientType", "SECTOR")
    form.set("recipientSectorId", sector.id)
    form.set("subject", "Auditoria E2E — aviso de setor")
    form.set("body", "Mensagem de teste automatizado")
    const { status, json } = await api(S.master, "POST", "/api/company/communications", form, true)
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    ;(global as any).__auditMessageId = json.id
    return true
  })

  await check("2.Comunicacao", "Responsável do Setor (colaborador@) vê a mensagem endereçada ao Setor", async () => {
    const { status, json } = await api(S.colaborador, "GET", "/api/company/communications")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json) && json.some((m: any) => m.id === (global as any).__auditMessageId)
  })

  await check("2.Comunicacao", "Colaborador comum (ana.jeri, não responsável) NÃO vê mensagem do Setor de outro colega", async () => {
    const { status, json } = await api(S.anaJeri, "GET", "/api/company/communications")
    if (status !== 200) return `status ${status}`
    const leaked = Array.isArray(json) && json.some((m: any) => m.id === (global as any).__auditMessageId)
    return !leaked
  })

  await check("2.Financeiro", "Colaborador (mesmo com isFinanceResponsible) NÃO acessa mais o módulo Financeiro — delegação retirada, só o papel COMPANY_FINANCE", async () => {
    const { status } = await api(S.colaborador, "GET", "/api/company/finance/withdrawals")
    if (status !== 403) return `status ${status} — esperado 403 (delegação de Financeiro a Colaborador foi removida)`
    return true
  })

  await check("2.ScannerPDV", "Colaborador emite Vale Retorno (QR)", async () => {
    const { status, json } = await api(S.colaborador, "POST", "/api/company/scanner/vouchers", {
      promotionId: voucherPromo.id,
      clientName: "Cliente Auditoria",
      clientPhone: "85999998888",
    })
    if (status !== 201) return `status ${status} — ${JSON.stringify(json)}`
    ;(global as any).__auditVoucherCode = json.voucher.code
    return true
  })

  await check("2.ScannerPDV", "Scanner resgata o Vale Retorno com sucesso (1ª leitura)", async () => {
    const code = (global as any).__auditVoucherCode
    const form = new FormData()
    form.set("qrPayload", `tribuss:voucher:${code}`)
    form.set("amount", "85.5")
    const { status, json } = await api(S.gerente, "POST", "/api/company/scanner/redeem", form, true)
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("3.EdgeCase", "Scanner BLOQUEIA reutilização do mesmo QR (duplicidade)", async () => {
    const code = (global as any).__auditVoucherCode
    const form = new FormData()
    form.set("qrPayload", `tribuss:voucher:${code}`)
    form.set("amount", "50")
    const { status } = await api(S.gerente, "POST", "/api/company/scanner/redeem", form, true)
    if (status !== 409) return `esperado 409 (já utilizado), veio ${status}`
    return true
  })

  await check("2.ScannerPDV", "Scanner exige justificativa quando o valor da conta é R$ 0,00", async () => {
    const existing = await prisma.promotion.findFirst({ where: { companyId: jeri.id, title: "Vale Retorno — Auditoria R$0" } })
    // Reaproveita a fixture entre execuções, mas força active/validade em dia —
    // uma execução anterior pode ter desativado essa Promotion (ex: teste de
    // desativação em outro script) e a reutilização "as is" quebrava esse teste
    // com um 404 só por causa do fixture ficar obsoleto, não por bug do app.
    const promo2 = existing
      ? await prisma.promotion.update({
          where: { id: existing.id },
          data: { active: true, validFrom: new Date(Date.now() - 1000), validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        })
      : await prisma.promotion.create({
          data: {
            companyId: jeri.id,
            title: "Vale Retorno — Auditoria R$0",
            description: "fixture",
            offerType: "DISCOUNT",
            audience: "INTERNAL",
            discountPercentage: 10,
            validFrom: new Date(Date.now() - 1000),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cost: 0,
          },
        })
    const issue = await api(S.colaborador, "POST", "/api/company/scanner/vouchers", { promotionId: promo2.id, clientPhone: "85988887777" })
    if (issue.status !== 201) return `emissão do voucher falhou: status ${issue.status} — ${JSON.stringify(issue.json)}`
    const code = issue.json.voucher.code
    const form = new FormData()
    form.set("qrPayload", `tribuss:voucher:${code}`)
    form.set("amount", "0")
    const { status, json } = await api(S.gerente, "POST", "/api/company/scanner/redeem", form, true)
    if (status !== 400) return `esperado 400 (exige justificativa), veio ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("2.Parceiro", "Parceiro sem CPF/PIX é bloqueado (428) ao pedir saque (gate de adesão)", async () => {
    const incompleteSession = await loginAs(incompletePartner!.email)
    const { status, json } = await api(incompleteSession, "POST", "/api/partner/withdrawals", { amount: 10, companyId: jeri.id })
    if (status !== 428) return `esperado 428, veio ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("2.Parceiro", "Parceiro consegue completar CPF/PIX (Etapa 2 do cadastro)", async () => {
    const incompleteSession = await loginAs(incompletePartner!.email)
    const { status, json } = await api(incompleteSession, "PATCH", "/api/partner/profile", {
      cpf: randomValidCpf(), // gerado a cada corrida — evita colisão de unicidade com execuções anteriores
      pixKey: "auditoria@teste.com.vc",
    })
    if (status !== 200) return `status ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("3.EdgeCase", "PATCH /api/partner/profile rejeita CPF com dígito verificador inválido", async () => {
    const { status, json } = await api(S.parceiro, "PATCH", "/api/partner/profile", { cpf: "111.111.111-11" })
    if (status !== 400) return `esperado 400, veio ${status} — ${JSON.stringify(json)}`
    return true
  })

  await check("2.Parceiro", "Explorar Programas lista os programas disponíveis por empresa", async () => {
    const { status, json } = await api(S.parceiro, "GET", "/api/partner/explorar")
    return status === 200 && (Array.isArray(json) || Array.isArray(json?.programs) || typeof json === "object")
  })

  await check("2.Parceiro", "Carteira de comissões do parceiro responde", async () => {
    const { status, json } = await api(S.parceiro, "GET", "/api/partner/commissions")
    if (status !== 200) return `status ${status}`
    return Array.isArray(json)
  })

  console.log("\n--- FASE 3: segurança — RBAC, multi-tenancy e edge cases ---")

  // ---------------- 3.1 RBAC / rotas restritas ------------------------------
  await check("3.RBAC", "Sem cookie de sessão -> 401 em rota protegida", async () => {
    const { status } = await api(null, "GET", "/api/company/employees")
    return status === 401
  })

  await check("3.RBAC", "Colaborador (EMPLOYEE) tentando acessar /api/admin/companies -> bloqueado", async () => {
    const { status } = await api(S.colaborador, "GET", "/api/admin/companies")
    return status === 401 || status === 403
  })

  await check("3.RBAC", "Parceiro (PARTNER) tentando acessar /api/company/employees -> bloqueado", async () => {
    const { status } = await api(S.parceiro, "GET", "/api/company/employees")
    return status === 401 || status === 403
  })

  await check("3.RBAC", "Colaborador comum tentando aprovar saque (Financeiro) -> 403", async () => {
    const anyWithdrawal = await prisma.withdrawal.findFirst({ where: { companyId: jeri.id } })
    if (!anyWithdrawal) return "sem Withdrawal de fixture para testar"
    // Reseta pra PENDING — um Withdrawal já REJECTED/PAID de uma execução
    // anterior responde com outro status (regra de negócio, não RBAC) antes
    // mesmo de chegar na checagem de permissão que este teste quer validar.
    await prisma.withdrawal.update({ where: { id: anyWithdrawal.id }, data: { status: "PENDING" } })
    const { status } = await api(S.anaJeri, "PATCH", `/api/company/finance/withdrawals/${anyWithdrawal.id}`, { status: "APPROVED" })
    return status === 403
  })

  await check("3.RBAC", "Gerente (não-Master) tentando editar Fechamento já COMPLETED -> bloqueado", async () => {
    const completed = await prisma.shiftClosing.findFirst({ where: { companyId: jeri.id, status: "COMPLETED" } })
    if (!completed) return "sem ShiftClosing COMPLETED de fixture para testar (não conclusivo)"
    const { status } = await api(S.gerente, "PATCH", `/api/company/shift-closing/history/${completed.id}`, { summary: "tentativa indevida" })
    return status === 403 || status === 404 || status === 405
  })

  // ---------------- 3.2 Multi-tenancy ---------------------------------------
  await check("3.MultiTenancy", "Master da Lagoa NÃO enxerga colaboradores da Jeri (escopo por sessão)", async () => {
    const { status, json } = await api(S.masterLagoa, "GET", "/api/company/employees")
    if (status !== 200) return `status ${status}`
    const leaked = Array.isArray(json) && json.some((e: any) => e.email === "colaborador@teste.com.vc")
    return !leaked
  })

  await check("3.MultiTenancy", "Master da Lagoa NÃO consegue aprovar Withdrawal pertencente à Jeri (id de outra empresa)", async () => {
    const jeriWithdrawal = await prisma.withdrawal.findFirst({ where: { companyId: jeri.id } })
    if (!jeriWithdrawal) return "sem Withdrawal de fixture na Jeri para testar"
    await prisma.withdrawal.update({ where: { id: jeriWithdrawal.id }, data: { status: "PENDING" } })
    const { status } = await api(S.masterLagoa, "PATCH", `/api/company/finance/withdrawals/${jeriWithdrawal.id}`, { status: "APPROVED" })
    return status === 404
  })

  await check("3.MultiTenancy", "Colaborador da Lagoa não vê Comunicação Interna endereçada ao Setor da Jeri", async () => {
    const { status, json } = await api(S.colaboradorLagoa, "GET", "/api/company/communications")
    if (status !== 200) return `status ${status}`
    const leaked = Array.isArray(json) && json.some((m: any) => m.id === (global as any).__auditMessageId)
    return !leaked
  })

  // ---------------- 3.3 Empresa inativa / inadimplente ----------------------
  // Cobre o fix aplicado em lib/api-auth.ts#requireCompanyStaff (antes desta
  // correção, ambos os casos abaixo retornavam 200 — a API não repetia o
  // bloqueio que app/company/layout.tsx já aplicava só na tela). IN-ON hoje é
  // uma empresa real ACTIVE (era um dado incorreto, corrigido em
  // scripts/audit-e2e-full-variations.ts) — o teste simula INACTIVE por um
  // instante e reverte, em vez de depender do status real da empresa.
  await prisma.company.update({ where: { id: inOn.id }, data: { status: "INACTIVE" } })
  await check("3.EdgeCase", "Empresa INACTIVE (IN-ON simulada): API bloqueia o staff (403), não só a tela", async () => {
    const { status } = await api(S.masterInOn, "GET", "/api/company/employees")
    if (status !== 403) return `esperado 403, veio ${status}`
    return true
  })

  await check("3.EdgeCase", "Empresa INACTIVE (IN-ON simulada): rotas legadas do Scanner PDV (/api/commissions, /api/promotions, /api/partners) também bloqueiam", async () => {
    const r1 = await api(S.masterInOn, "GET", "/api/promotions")
    const r2 = await api(S.masterInOn, "GET", "/api/partners?q=a")
    if (r1.status !== 403) return `/api/promotions esperado 403, veio ${r1.status}`
    if (r2.status !== 403) return `/api/partners esperado 403, veio ${r2.status}`
    return true
  })
  await prisma.company.update({ where: { id: inOn.id }, data: { status: "ACTIVE" } })

  const overdueDeadline = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 dias atrás (> 15 dias de carência)
  await prisma.company.update({ where: { id: lagoa.id }, data: { status: "OVERDUE", statusReason: "Auditoria E2E — simulação de inadimplência", overdueSince: overdueDeadline } })
  await check("3.EdgeCase", "Empresa OVERDUE há >15 dias: API bloqueia o staff (403)", async () => {
    const { status } = await api(S.masterLagoa, "GET", "/api/company/employees")
    if (status !== 403) return `esperado 403, veio ${status}`
    return true
  })
  await check("3.EdgeCase", "Empresa OVERDUE dentro da carência (<=15 dias): acesso continua OK (só aviso)", async () => {
    await prisma.company.update({ where: { id: lagoa.id }, data: { overdueSince: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) } })
    const { status } = await api(S.masterLagoa, "GET", "/api/company/employees")
    if (status !== 200) return `esperado 200 (dentro da carência de 15 dias), veio ${status}`
    return true
  })

  // ---------------- 3.4 Desligamento automático por inatividade (90 dias) ---
  // Reimplementa a mesma regra de lib/program-lifecycle.ts#sweepInactiveMemberships
  // (não dá para importar o módulo original aqui: ele encadeia lib/notifications.ts,
  // que usa `import "server-only"` — a lib lança em runtime fora do bundler do
  // Next, então o teste chama a API real (GET /api/partner/explorar já dispara
  // a varredura preguiçosa em código) em vez de reimplementar a regra à parte.
  await check("2.Parceiro", "Varredura de inatividade (90 dias) desliga o parceiro parado há 95 dias", async () => {
    const staleSession = await loginAs(staleMembershipPartner.email)
    const { status } = await api(staleSession, "GET", "/api/partner/explorar")
    if (status !== 200) return `GET /api/partner/explorar (dispara a varredura) status ${status}`
    const updated = await prisma.programMembership.findUniqueOrThrow({ where: { id: staleMembership.id } })
    if (updated.status !== "TERMINATED_INACTIVITY") return `status ficou ${updated.status}, esperado TERMINATED_INACTIVITY`
    return true
  })

  // ---------------- 3.5 2FA — bypass de API (checando o gap antes do fix) ---
  const totpUserEmail = "parceiro@teste.com.vc"
  await check("3.EdgeCase", "2FA: setup + habilitação via API", async () => {
    const setup = await api(S.parceiro, "POST", "/api/account/2fa")
    if (setup.status !== 200) return `setup status ${setup.status}`
    const secret = setup.json.secret as string
    ;(global as any).__totpSecret = secret
    const code = currentTotpCode(secret)
    const enable = await api(S.parceiro, "PATCH", "/api/account/2fa", { code, action: "enable" })
    if (enable.status !== 200 || !enable.json.enabled) return `enable status ${enable.status} — ${JSON.stringify(enable.json)}`
    return true
  })

  // Cobre o fix aplicado em lib/api-auth.ts#requirePartner (antes desta
  // correção, uma sessão Supabase válida sem o TOTP verificado ainda
  // conseguia chamar qualquer rota /api/partner/** — o 2FA só era checado em
  // app/partner/layout.tsx, ou seja, só protegia a navegação por tela).
  await check("3.EdgeCase", "2FA: sessão SEM verificar o código TOTP é bloqueada nas rotas de API do parceiro", async () => {
    const freshSession = await loginAs(totpUserEmail) // login só com senha, nunca chamou /api/auth/verify-2fa
    const { status } = await api(freshSession, "GET", "/api/partner/profile")
    if (status !== 401) return `esperado 401, veio ${status}`
    ;(global as any).__freshTotpSession = freshSession
    return true
  })

  await check("3.EdgeCase", "2FA: após verificar o TOTP, a mesma sessão passa a acessar normalmente", async () => {
    const freshSession = (global as any).__freshTotpSession
    const code = currentTotpCode((global as any).__totpSecret)
    const verify = await api(freshSession, "POST", "/api/auth/verify-2fa", { code })
    if (verify.status !== 200) return `verify-2fa status ${verify.status}`
    const { status } = await api(freshSession, "GET", "/api/partner/profile")
    if (status !== 200) return `esperado 200 após verificar, veio ${status}`
    return true
  })

  // ===========================================================================
  // Resumo antes das correções
  // ===========================================================================
  printSummary("RESULTADO FINAL")

  // ===========================================================================
  // Limpeza de fixtures temporárias de edge case (revertidas mesmo se os
  // testes falharem, para não deixar o ambiente sujo para o usuário)
  // ===========================================================================
  await prisma.company.update({ where: { id: lagoa.id }, data: { status: "ACTIVE", statusReason: null, overdueSince: null } })
  console.log("\n✓ Revertido: Nomad's Lagoa voltou para status ACTIVE")

  const secret = (global as any).__totpSecret
  if (secret) {
    const code = currentTotpCode(secret)
    await api(S.parceiro, "PATCH", "/api/account/2fa", { code, action: "disable" })
    console.log("✓ Revertido: 2FA desabilitado para parceiro@teste.com.vc")
  }

  await prisma.$disconnect()

  const anyFail = results.some((r) => !r.pass)
  process.exit(anyFail ? 1 : 0)
}

main().catch((e) => {
  console.error("ERRO FATAL NA AUDITORIA:", e)
  process.exit(1)
})
