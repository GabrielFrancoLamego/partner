// One-off: cria uma empresa de teste e um usuário real (Supabase Auth + Prisma)
// para cada role, todos com senha "123456". Rodar com: node scripts/seed.mjs
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient } from "@supabase/supabase-js"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = "123456"

// listUsers() pagina 50 por padrão — com 150+ contas no projeto, precisa varrer todas as páginas.
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 200) return null
  }
  return null
}

async function createAuthUser(email) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) {
    if (error.message.includes("already been registered") || error.status === 422) {
      const existing = await findAuthUserByEmail(email)
      if (existing) return existing
    }
    throw error
  }
  return data.user
}

// Régua padrão do Programa de Crescimento — aplicada às 3 empresas no seed.
const CAREER_LEVELS = [
  { name: "Trainee", order: 0, requiredXp: 0, badgeColorHex: "#9CA3AF" },
  { name: "Júnior", order: 1, requiredXp: 100, badgeColorHex: "#60A5FA" },
  { name: "Pleno", order: 2, requiredXp: 300, badgeColorHex: "#34D399" },
  { name: "Sênior", order: 3, requiredXp: 600, badgeColorHex: "#F58220", bonusDescription: "+R$150 no salário" },
  { name: "Supervisor", order: 4, requiredXp: 1000, badgeColorHex: "#3E2415", bonusDescription: "+R$300 no salário" },
]

const REWARD_CATALOG = [
  { name: "Vale-lanche", costXp: 50, description: "Vale de R$20 para lanche na equipe" },
  { name: "Folga extra", costXp: 200, description: "Um dia de folga adicional" },
  { name: "Camiseta da equipe", costXp: 80, description: "Camiseta oficial Tribuss" },
]

async function seedGrowthProgram(companyId) {
  for (const level of CAREER_LEVELS) {
    await prisma.careerLevel.upsert({
      where: { companyId_order: { companyId, order: level.order } },
      update: {},
      create: { companyId, ...level },
    })
  }
  for (const reward of REWARD_CATALOG) {
    const existing = await prisma.rewardCatalogItem.findFirst({ where: { companyId, name: reward.name } })
    if (!existing) {
      await prisma.rewardCatalogItem.create({ data: { companyId, ...reward } })
    }
  }
}

async function main() {
  // Coordenadas reais das praças de atuação — usadas no geofence do Ponto
  // Digital (Company.latitude/longitude/geofenceRadiusMeters). Raio generoso
  // (300m) para ambiente de testes local, onde o GPS do dispositivo tem
  // imprecisão maior.
  const jeriGeo = {
    city: "Jijoca de Jericoacoara",
    state: "CE",
    latitude: -2.7975,
    longitude: -40.5137,
    geofenceRadiusMeters: 300,
  }
  const lagoaGeo = { city: "Florianópolis", state: "SC", latitude: -27.6084, longitude: -48.4823, geofenceRadiusMeters: 300 }

  const company = await prisma.company.upsert({
    where: { slug: "nomads-jeri" },
    update: jeriGeo,
    create: { name: "Nomad's Jeri", slug: "nomads-jeri", ...jeriGeo },
  })
  console.log("Empresa:", company.name, company.id)

  const lagoa = await prisma.company.upsert({
    where: { slug: "nomads-lagoa" },
    update: lagoaGeo,
    create: { name: "Nomad's Lagoa", slug: "nomads-lagoa", ...lagoaGeo },
  })
  console.log("Empresa:", lagoa.name, lagoa.id)

  const inOn = await prisma.company.upsert({
    where: { slug: "in-on" },
    update: jeriGeo,
    create: { name: "IN-ON", slug: "in-on", ...jeriGeo },
  })
  console.log("Empresa:", inOn.name, inOn.id)

  const users = [
    { email: "admin@teste.com.vc", name: "Admin Plataforma", role: "ADMIN", companyId: null },
    { email: "master@teste.com.vc", name: "Master Nomad's Jeri", role: "COMPANY_MASTER", companyId: company.id },
    { email: "gerente@teste.com.vc", name: "Gerente Nomad's Jeri", role: "COMPANY_GERENTE", companyId: company.id },
    {
      email: "financeiro@teste.com.vc",
      name: "Financeiro Nomad's Jeri",
      role: "COMPANY_FINANCE",
      companyId: company.id,
    },
    { email: "colaborador@teste.com.vc", name: "Colaborador Teste", role: "EMPLOYEE", companyId: company.id },
    { email: "parceiro@teste.com.vc", name: "Parceiro Teste", role: "PARTNER", companyId: null },
    { email: "master.lagoa@teste.com.vc", name: "Master Nomad's Lagoa", role: "COMPANY_MASTER", companyId: lagoa.id },
    {
      email: "gerente.lagoa@teste.com.vc",
      name: "Gerente Nomad's Lagoa",
      role: "COMPANY_GERENTE",
      companyId: lagoa.id,
    },
    {
      email: "financeiro.lagoa@teste.com.vc",
      name: "Financeiro Nomad's Lagoa",
      role: "COMPANY_FINANCE",
      companyId: lagoa.id,
    },
    {
      email: "colaborador.lagoa@teste.com.vc",
      name: "Colaborador Nomad's Lagoa",
      role: "EMPLOYEE",
      companyId: lagoa.id,
    },
    { email: "master.inon@teste.com.vc", name: "Master IN-ON", role: "COMPANY_MASTER", companyId: inOn.id },
    { email: "gerente.inon@teste.com.vc", name: "Gerente IN-ON", role: "COMPANY_GERENTE", companyId: inOn.id },
    { email: "financeiro.inon@teste.com.vc", name: "Financeiro IN-ON", role: "COMPANY_FINANCE", companyId: inOn.id },
    { email: "colaborador.inon@teste.com.vc", name: "Colaborador IN-ON", role: "EMPLOYEE", companyId: inOn.id },
  ]

  for (const u of users) {
    const authUser = await createAuthUser(u.email)

    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: { name: u.name, role: u.role, companyId: u.companyId },
      create: { id: authUser.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId },
    })

    if (u.role === "EMPLOYEE") {
      await prisma.employeeProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, isScannerOnly: false },
      })
    }

    if (u.role === "PARTNER") {
      await prisma.partnerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, partnerType: "INDIVIDUAL", document: "000.000.000-00" },
      })
    }

    console.log(`✓ ${u.role.padEnd(16)} ${u.email} (${authUser.id})`)
  }

  for (const c of [company, lagoa, inOn]) {
    await seedGrowthProgram(c.id)
    console.log(`✓ Programa de Crescimento (níveis + loja de prêmios) — ${c.name}`)
  }

  console.log("\nSenha para todos: 123456")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
