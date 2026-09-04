/**
 * Carga histórica de parceiros a partir da planilha legada de créditos.
 *
 * Uso:
 *   1. Exporte a planilha para JSON no formato `LegacyPartnerRecord[]` abaixo
 *      e salve em `prisma/partners-data.json` (arquivo git-ignorado — nunca
 *      commitar dados reais de parceiros).
 *   2. Rode `npm run db:seed-partners`.
 *
 * O script é seguro para rodar mais de uma vez: usuários são upsert por
 * email/id, e o histórico (indicações/saques) de um parceiro só é importado
 * uma vez — se o parceiro já tiver indicações registradas na empresa, a
 * importação de histórico para aquele par (parceiro, empresa) é pulada.
 *
 * `currentBalance` é a fonte da verdade do saldo (grava direto em
 * PartnerProfile.walletBalance); os registros de Referral/Commission/
 * Withdrawal criados aqui são o histórico para auditoria/extrato — eles NÃO
 * são somados automaticamente para recalcular o saldo.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient } from "@supabase/supabase-js"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_PASSWORD = "123456" // mesma convenção do scripts/seed.mjs — ambiente local

type LegacyReferral = {
  clientName: string
  clientEmail?: string
  clientPhone?: string
  indicatedAt: string // ISO date
  visited?: boolean
  billAmount?: number
  commissionAmount?: number
}

type LegacyWithdrawal = {
  amount: number
  requestDate: string // ISO date
  status?: "PENDING" | "APPROVED" | "REJECTED" | "PAID"
  pixKey?: string
  paidAt?: string // ISO date
}

type LegacyPartnerRecord = {
  companySlug: string // precisa já existir em Company.slug ("nomads-jeri", "nomads-lagoa", "in-on", ...)
  name: string
  email: string
  phone?: string
  document?: string // CPF (INDIVIDUAL) ou CNPJ (AGENCY)
  partnerType?: "INDIVIDUAL" | "AGENCY"
  pixKey?: string
  currentBalance: number
  referrals?: LegacyReferral[]
  withdrawals?: LegacyWithdrawal[]
}

const DATA_FILE = path.join(__dirname, "partners-data.json")

function loadLegacyData(): LegacyPartnerRecord[] {
  if (!existsSync(DATA_FILE)) {
    console.log(`Nenhum arquivo encontrado em ${DATA_FILE}.`)
    console.log("Exporte a planilha de parceiros para esse caminho no formato LegacyPartnerRecord[] e rode de novo.")
    return []
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8")) as LegacyPartnerRecord[]
}

async function createOrGetAuthUser(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  })
  if (error || !data.user) {
    if (error?.message.includes("already been registered") || error?.status === 422) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const existing = list.users.find((u) => u.email === email)
      if (existing) return existing
    }
    throw error
  }
  return data.user
}

async function importPartner(record: LegacyPartnerRecord) {
  const company = await prisma.company.findUnique({ where: { slug: record.companySlug } })
  if (!company) {
    console.warn(`⚠ Empresa "${record.companySlug}" não encontrada — pulando parceiro ${record.email}`)
    return
  }

  const authUser = await createOrGetAuthUser(record.email)

  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { name: record.name },
    create: { id: authUser.id, email: record.email, name: record.name, role: "PARTNER" },
  })

  await prisma.partnerProfile.upsert({
    where: { userId: user.id },
    update: {
      document: record.document,
      phone: record.phone,
      pixKey: record.pixKey,
      partnerType: record.partnerType ?? "INDIVIDUAL",
      walletBalance: record.currentBalance,
    },
    create: {
      userId: user.id,
      document: record.document,
      phone: record.phone,
      pixKey: record.pixKey,
      partnerType: record.partnerType ?? "INDIVIDUAL",
      walletBalance: record.currentBalance,
    },
  })

  const existingReferrals = await prisma.referral.count({ where: { partnerId: user.id, companyId: company.id } })
  if (existingReferrals > 0) {
    console.log(`↷ ${record.email}: histórico já importado para ${company.name}, pulando indicações/saques.`)
    return
  }

  for (const r of record.referrals ?? []) {
    const referral = await prisma.referral.create({
      data: {
        companyId: company.id,
        partnerId: user.id,
        clientName: r.clientName,
        clientEmail: r.clientEmail ?? "",
        clientPhone: r.clientPhone ?? "",
        indicatedAt: new Date(r.indicatedAt),
        visited: r.visited ?? Boolean(r.commissionAmount),
        status: r.visited || r.commissionAmount ? "VISITED" : "NOT_VISITED",
        billAmount: r.billAmount,
        commissionAmount: r.commissionAmount,
      },
    })

    if (r.commissionAmount) {
      await prisma.commission.create({
        data: {
          companyId: company.id,
          partnerId: user.id,
          referralId: referral.id,
          clientName: r.clientName,
          amount: r.billAmount,
          commissionValue: r.commissionAmount,
          status: "PAID",
          date: new Date(r.indicatedAt),
        },
      })
    }
  }

  for (const w of record.withdrawals ?? []) {
    await prisma.withdrawal.create({
      data: {
        companyId: company.id,
        partnerId: user.id,
        amount: w.amount,
        requestDate: new Date(w.requestDate),
        status: w.status ?? "PAID",
        pixKey: w.pixKey,
        paidAt: w.paidAt ? new Date(w.paidAt) : undefined,
      },
    })
  }

  console.log(
    `✓ ${record.email} — saldo R$ ${record.currentBalance} · ${record.referrals?.length ?? 0} indicações · ${
      record.withdrawals?.length ?? 0
    } saques (${company.name})`,
  )
}

async function main() {
  const records = loadLegacyData()
  if (records.length === 0) {
    await prisma.$disconnect()
    return
  }

  for (const record of records) {
    await importPartner(record)
  }

  console.log(`\nConcluído: ${records.length} parceiro(s) processado(s).`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
