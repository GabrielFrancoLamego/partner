/**
 * Popula a Fila de Aprovações Pendentes (/admin/cadastros?tab=approvals e
 * painel do Master) com PublicRegistrationRequest em PENDING_APPROVAL — um
 * de cada tipo (empresa nova, colaborador, parceiro genérico, parceiro
 * pré-vinculado a uma empresa) — para testar o fluxo de aprovação/rejeição e
 * as notificações automáticas (ver lib/notifications.ts) sem precisar
 * preencher os formulários públicos manualmente.
 *
 * Uso: npm run db:seed-pending-approvals
 * Idempotente: usa upsert por email, roda de novo sem duplicar.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient, Prisma } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function upsertPending(
  email: string,
  data: Omit<Prisma.PublicRegistrationRequestUncheckedCreateInput, "email">,
) {
  const existing = await prisma.publicRegistrationRequest.findFirst({ where: { email, status: "PENDING_APPROVAL" } })
  if (existing) {
    console.log(`  já existe: ${email}`)
    return
  }
  await prisma.publicRegistrationRequest.create({ data: { ...data, email } })
  console.log(`  criado: ${email}`)
}

async function main() {
  const jeri = await prisma.company.findUnique({ where: { slug: "nomads-jeri" } })
  if (!jeri) throw new Error("Rode antes: npm run db:seed-simulation (precisa da empresa nomads-jeri)")

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  if (!admin) throw new Error("Nenhum usuário ADMIN encontrado — rode antes o seed principal")

  const sector = await prisma.sector.findFirst({ where: { companyId: jeri.id } })

  // approve/route.ts só provisiona Company+Master quando o request veio de um
  // link real do tipo COMPANY_SIGNUP (ver app/api/public/company-signup) —
  // sem isso a aprovação criaria um COMPANY_MASTER órfão, sem empresa.
  const companySignupLink = await prisma.publicRegistrationLink.upsert({
    where: { token: "seed-company-signup-demo" },
    update: {},
    create: {
      token: "seed-company-signup-demo",
      type: "COMPANY_SIGNUP",
      plan: "STANDARD",
      createdById: admin.id,
    },
  })

  console.log("Empresa nova (COMPANY_SIGNUP)...")
  await upsertPending("contato.pousadavista@teste.com.vc", {
    linkId: companySignupLink.id,
    role: "COMPANY_MASTER",
    name: "Pousada Vista Mar",
    desiredCompanySlug: "pousada-vista-mar",
    masterName: "Renata Cavalcante",
    phone: "(88) 99911-2233",
  })

  console.log("Colaborador (EMPLOYEE) pendente na Nomad's Jeri...")
  await upsertPending("pendente.colaborador@teste.com.vc", {
    role: "EMPLOYEE",
    companyId: jeri.id,
    sectorId: sector?.id ?? null,
    name: "Bruno Feitosa",
    phone: "(85) 98822-1144",
    document: "123.456.789-00",
  })

  console.log("Parceiro genérico (PARTNER) pendente...")
  await upsertPending("pendente.parceiro@teste.com.vc", {
    role: "PARTNER",
    name: "Vanessa Lima Guia de Turismo",
    phone: "(85) 99733-5566",
    document: "987.654.321-00",
  })

  console.log("Parceiro pré-vinculado à Nomad's Jeri (PARTNER_FOR_COMPANY)...")
  await upsertPending("pendente.parceiro.jeri@teste.com.vc", {
    role: "PARTNER",
    companyId: jeri.id,
    name: "Hostel Vento Norte (Agência)",
    phone: "(85) 98644-7788",
    document: "12.345.678/0001-90",
  })

  console.log("\nOK — abra /admin/cadastros?tab=approvals ou o painel do Master para ver a fila.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
