/**
 * Preenche latitude/longitude das empresas de demonstração (Nomad's Jeri,
 * Nomad's Lagoa, IN-ON) — pré-requisito para o Mapa Interativo de Programas
 * (/partner/mapa) mostrar os pinos. Sem isso a Company fica de fora da
 * query do mapa (que exige latitude/longitude != null).
 *
 * Uso: npm run db:seed-coordinates
 * Idempotência: só define as coordenadas se ainda estiverem vazias — rodar
 * de novo não sobrescreve um ajuste manual feito depois no Admin.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const COORDINATES: { slug: string; latitude: number; longitude: number }[] = [
  { slug: "nomads-jeri", latitude: -2.7955, longitude: -40.5128 }, // Jericoacoara, CE
  { slug: "nomads-lagoa", latitude: -2.8312, longitude: -40.4735 }, // Lagoa do Paraíso, próxima a Jeri
  { slug: "in-on", latitude: -3.7327, longitude: -38.5267 }, // Fortaleza, CE
]

async function main() {
  for (const { slug, latitude, longitude } of COORDINATES) {
    const company = await prisma.company.findUnique({ where: { slug } })
    if (!company) {
      console.log(`↷ ${slug}: empresa não encontrada — pulando.`)
      continue
    }
    if (company.latitude !== null && company.longitude !== null) {
      console.log(`↷ ${company.name}: já tem coordenadas (${company.latitude}, ${company.longitude}) — pulando.`)
      continue
    }
    await prisma.company.update({ where: { id: company.id }, data: { latitude, longitude } })
    console.log(`✓ ${company.name}: coordenadas definidas (${latitude}, ${longitude})`)
  }
  console.log("\nConcluído.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
