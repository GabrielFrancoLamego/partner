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

async function createAuthUser(email) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) {
    if (error.message.includes("already been registered") || error.status === 422) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const existing = list.users.find((u) => u.email === email)
      if (existing) return existing
    }
    throw error
  }
  return data.user
}

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "nomads-jeri" },
    update: {},
    create: { name: "Nomad's Jeri", slug: "nomads-jeri" },
  })
  console.log("Empresa:", company.name, company.id)

  const lagoa = await prisma.company.upsert({
    where: { slug: "nomads-lagoa" },
    update: {},
    create: { name: "Nomad's Lagoa", slug: "nomads-lagoa" },
  })
  console.log("Empresa:", lagoa.name, lagoa.id)

  const inOn = await prisma.company.upsert({
    where: { slug: "in-on" },
    update: {},
    create: { name: "IN-ON", slug: "in-on" },
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
    { email: "master.inon@teste.com.vc", name: "Master IN-ON", role: "COMPANY_MASTER", companyId: inOn.id },
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

  console.log("\nSenha para todos: 123456")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
