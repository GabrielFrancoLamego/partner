import { config } from "dotenv"
config({ path: ".env.local" })

import { randomUUID } from "crypto"
import { PrismaClient, type SettlementPaymentMethod } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient } from "@supabase/supabase-js"
import { jsPDF } from "jspdf"

/**
 * Seed de Registro de Quitação para testes: popula FinancialSettlement com
 * pagamentos efetuados nos últimos 30 dias (saques PIX de parceiros e
 * diárias/vales de colaboradores) em todas as empresas, com comprovantes PDF
 * simulados enviados ao Supabase Storage (+ alguns comprovantes em imagem).
 *
 * Só grava a quitação (extrato) — não cria Withdrawal/Occurrence nem mexe em
 * carteiras, saldos ou "Sua Conta", então não distorce nenhum outro número.
 * Idempotente: tudo que o seed cria tem descrição "[Seed] ..." e é removido
 * antes de recriar. Uso: npx tsx scripts/seed-quitacoes.ts
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const BUCKET = "uploads"
const TAG = "[Seed]"
const SAMPLE_IMAGE = "https://placehold.co/600x800/png?text=Comprovante+Simulado"

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const METHOD_LABEL: Record<SettlementPaymentMethod, string> = { PIX: "Pix", DINHEIRO: "Dinheiro", TRANSFERENCIA: "Transferência Bancária", CONSUMO: "Consumo Interno" }

async function uploadReceiptPdf(info: { favorecido: string; valor: number; metodo: SettlementPaymentMethod; motivo: string; paidAt: Date; empresa: string }) {
  const doc = new jsPDF({ unit: "pt", format: "a5" })
  doc.setFontSize(16)
  doc.text("COMPROVANTE DE PAGAMENTO (SIMULADO)", 30, 50)
  doc.setFontSize(11)
  const lines = [
    `Empresa: ${info.empresa}`,
    `Favorecido: ${info.favorecido}`,
    `Valor: ${money(info.valor)}`,
    `Forma de pagamento: ${METHOD_LABEL[info.metodo]}`,
    `Motivo: ${info.motivo}`,
    `Pago em: ${info.paidAt.toLocaleString("pt-BR")}`,
    "",
    "Documento gerado pelo seed de testes — sem valor fiscal.",
  ]
  lines.forEach((line, i) => doc.text(line, 30, 90 + i * 22))
  const bytes = new Uint8Array(doc.output("arraybuffer"))

  const path = `receipts/seed-${randomUUID()}.pdf`
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false })
  if (error) throw new Error(`Falha ao subir comprovante: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

function daysAgo(days: number, hour: number, minute: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function removePreviousSeedFiles() {
  const { data } = await supabase.storage.from(BUCKET).list("receipts", { search: "seed-", limit: 1000 })
  const files = (data ?? []).filter((f) => f.name.startsWith("seed-")).map((f) => `receipts/${f.name}`)
  if (files.length > 0) await supabase.storage.from(BUCKET).remove(files)
  return files.length
}

async function main() {
  const removedFiles = await removePreviousSeedFiles().catch(() => 0)
  const removedRows = await prisma.financialSettlement.deleteMany({ where: { description: { startsWith: TAG } } })
  console.log(`Limpeza: ${removedRows.count} quitação(ões) e ${removedFiles} comprovante(s) de seeds anteriores removidos.`)

  // Só empresas reais — as de fixture dos testes E2E terminam em "(E2E)".
  const companies = await prisma.company.findMany({ where: { NOT: { name: { contains: "(E2E)" } } }, select: { id: true, name: true } })
  const partners = await prisma.user.findMany({
    where: { role: "PARTNER", status: "ACTIVE" },
    select: { id: true, name: true, partnerProfile: { select: { fullName: true, cpf: true, document: true, pixKey: true } } },
    take: 4,
  })
  if (partners.length === 0) throw new Error("Nenhum parceiro ativo encontrado para o seed")

  let total = 0
  for (const company of companies) {
    const master = await prisma.user.findFirst({ where: { companyId: company.id, role: "COMPANY_MASTER" }, select: { id: true } })
    if (!master) continue
    const employees = await prisma.user.findMany({
      where: { companyId: company.id, role: "EMPLOYEE", status: "ACTIVE", NOT: { name: { startsWith: "[Audit" } } },
      select: { id: true, name: true, employeeProfile: { select: { fullName: true, cpf: true, pixKey: true } } },
      take: 4,
    })

    type Plan = { kind: "WITHDRAWAL" | "OCCURRENCE"; recipientType: "PARTNER" | "EMPLOYEE"; recipientId: string; name: string; document: string | null; pix: string | null; motivo: string; amount: number; method: SettlementPaymentMethod }
    const plans: Plan[] = []

    for (let i = 0; i < 8; i++) {
      const p = partners[i % partners.length]
      plans.push({
        kind: "WITHDRAWAL",
        recipientType: "PARTNER",
        recipientId: p.id,
        name: p.partnerProfile?.fullName?.trim() || p.name,
        document: p.partnerProfile?.cpf ?? p.partnerProfile?.document ?? null,
        pix: p.partnerProfile?.pixKey ?? `seed-pix-${i}@tribuss.test`,
        motivo: "Saque PIX de parceiro",
        amount: [35, 62.5, 120, 48.9, 210, 75, 90.25, 150][i],
        method: i % 3 === 2 ? "TRANSFERENCIA" : "PIX",
      })
    }
    employees.forEach((e, i) => {
      for (const [motivo, amounts] of [["Diária", [90, 120]], ["Vale/Adiantamento", [50, 70]]] as const) {
        plans.push({
          kind: "OCCURRENCE",
          recipientType: "EMPLOYEE",
          recipientId: e.id,
          name: e.employeeProfile?.fullName?.trim() || e.name,
          document: e.employeeProfile?.cpf ?? null,
          pix: e.employeeProfile?.pixKey ?? null,
          motivo,
          amount: amounts[i % amounts.length],
          method: motivo === "Diária" ? (i % 2 === 0 ? "DINHEIRO" : "PIX") : "PIX",
        })
      }
    })

    let created = 0
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i]
      // Espalha de hoje até ~29 dias atrás (jitter de horário para não ficar uniforme).
      const spread = plans.length > 1 ? Math.round((i * 29) / (plans.length - 1)) : 0
      const paidAt = daysAgo(spread, 9 + ((i * 3) % 9), (i * 17) % 60)
      const dueDate = daysAgo(spread + (i % 2), 9, 0)
      // Dois comprovantes em imagem para exercitar o visualizador de imagem; o resto em PDF.
      const proofUrl =
        i % 7 === 3
          ? SAMPLE_IMAGE
          : await uploadReceiptPdf({ favorecido: plan.name, valor: plan.amount, metodo: plan.method, motivo: plan.motivo, paidAt, empresa: company.name })

      await prisma.financialSettlement.create({
        data: {
          companyId: company.id,
          sourceKind: plan.kind,
          sourceId: `seed-${randomUUID()}`,
          recipientType: plan.recipientType,
          recipientId: plan.recipientId,
          recipientName: plan.name,
          recipientDocument: plan.document,
          pixKey: plan.pix,
          description: `${TAG} ${plan.motivo}`,
          amount: plan.amount,
          dueDate,
          paymentMethod: plan.method,
          proofUrl,
          paidById: master.id,
          paidAt,
        },
      })
      created++
    }
    total += created
    console.log(`✓ ${company.name}: ${created} quitações (${plans.filter((p) => p.kind === "WITHDRAWAL").length} saques de parceiros + ${plans.filter((p) => p.kind === "OCCURRENCE").length} diárias/vales) nos últimos 30 dias`)
  }

  console.log(`\nSeed concluído — ${total} quitações criadas. Abra /company/financeiro?tab=quitacoes.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
