/**
 * Simulação de 15 dias de histórico do PONTO DIGITAL para os colaboradores
 * de uma empresa — mistura de dias normais, atrasos (além da tolerância) e
 * horas extras, além de 1 ocorrência de "Folga Compensatória" por
 * colaborador abatendo o Banco de Horas acumulado.
 *
 * Uso: npm run db:seed-timeclock [slug-da-empresa]
 * (slug padrão: nomads-jeri; passe outro slug como argumento para semear
 * outra empresa, ex: `npm run db:seed-timeclock nomads-lagoa`)
 *
 * Idempotência: só semeia um colaborador se ele ainda não tiver nenhuma
 * TimeEntry nos últimos 15 dias — rodar de novo não duplica.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const DAYS_OF_HISTORY = 15
const LATE_TOLERANCE_MINUTES = 15

function dayAt(daysAgo: number, hour: number, minute: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}
function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function jitter(coord: number) {
  return coord + rand(-0.0006, 0.0006)
}
function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return { h, m }
}

type DayKind = "NORMAL" | "LATE" | "OVERTIME"

/** ~55% normal, ~25% atraso, ~20% hora extra — distribuição realista de 15 dias. */
function pickDayKind(): DayKind {
  const r = Math.random()
  if (r < 0.55) return "NORMAL"
  if (r < 0.8) return "LATE"
  return "OVERTIME"
}

async function seedEmployeeTimeclock(params: {
  companyId: string
  employeeId: string
  latitude: number
  longitude: number
  workStartTime: string
  workEndTime: string
}) {
  const { companyId, employeeId, latitude, longitude, workStartTime, workEndTime } = params
  const start = parseTime(workStartTime)
  const end = parseTime(workEndTime)

  let bankDelta = 0
  let lateDays = 0
  let overtimeDays = 0

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 1; daysAgo--) {
    // Pula domingos para uma simulação mais realista (sem batida de ponto de folga).
    const weekday = dayAt(daysAgo, 12, 0).getDay()
    if (weekday === 0) continue

    const kind = pickDayKind()

    let checkInMinuteOffset = Math.round(rand(-5, 5))
    let checkOutMinuteOffset = Math.round(rand(-10, 10))

    if (kind === "LATE") {
      checkInMinuteOffset = LATE_TOLERANCE_MINUTES + Math.round(rand(10, 45))
      lateDays++
      bankDelta -= checkInMinuteOffset - LATE_TOLERANCE_MINUTES
    } else if (kind === "OVERTIME") {
      checkOutMinuteOffset = LATE_TOLERANCE_MINUTES + Math.round(rand(30, 90))
      overtimeDays++
      bankDelta += checkOutMinuteOffset - LATE_TOLERANCE_MINUTES
    }

    const checkIn = dayAt(daysAgo, start.h, start.m + checkInMinuteOffset)
    const breakStart = dayAt(daysAgo, 12, Math.round(rand(0, 15)))
    const breakEnd = dayAt(daysAgo, 13, Math.round(rand(0, 10)))
    const checkOut = dayAt(daysAgo, end.h, end.m + checkOutMinuteOffset)

    for (const [type, createdAt] of [
      ["CHECK_IN", checkIn],
      ["BREAK_START", breakStart],
      ["BREAK_END", breakEnd],
      ["CHECK_OUT", checkOut],
    ] as const) {
      await prisma.timeEntry.create({
        data: { userId: employeeId, companyId, type, latitude: jitter(latitude), longitude: jitter(longitude), createdAt },
      })
    }
  }

  if (bankDelta !== 0) {
    await prisma.employeeProfile.update({ where: { userId: employeeId }, data: { bankOfHoursMinutes: { increment: bankDelta } } })
  }

  return { lateDays, overtimeDays, bankDelta }
}

/** Lança 1 "Folga Compensatória" (BANCO_HORAS) abatendo parte do saldo acumulado — só se houver saldo positivo suficiente. */
async function seedCompensatoryDayOff(companyId: string, employeeId: string, createdById: string) {
  const profile = await prisma.employeeProfile.findUniqueOrThrow({ where: { userId: employeeId } })
  if (profile.bankOfHoursMinutes < 240) return null // exige ao menos 4h de saldo para conceder a folga

  const hoursToDeduct = 8 // 1 dia de folga = 8h abatidas do banco
  const occurrence = await prisma.occurrence.create({
    data: {
      companyId,
      employeeId,
      type: "BANCO_HORAS",
      date: dayAt(2, 0, 0),
      value: hoursToDeduct,
      quantity: 1,
      total: hoursToDeduct,
      description: "Folga Compensatória — abatida do Banco de Horas",
      createdById,
    },
  })
  await prisma.employeeProfile.update({ where: { userId: employeeId }, data: { bankOfHoursMinutes: { decrement: hoursToDeduct * 60 } } })
  return occurrence
}

async function main() {
  const slug = process.argv[2] ?? "nomads-jeri"
  console.log(`Semeando ${DAYS_OF_HISTORY} dias de Ponto Digital para "${slug}"...\n`)

  const company = await prisma.company.findUniqueOrThrow({ where: { slug } })
  const master = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "COMPANY_MASTER" } })
  const employees = await prisma.user.findMany({
    where: { companyId: company.id, role: "EMPLOYEE", status: "ACTIVE" },
    include: { employeeProfile: true },
    orderBy: { createdAt: "asc" },
  })

  if (employees.length === 0) {
    console.log("Nenhum colaborador ativo encontrado — rode db:seed-demo primeiro.")
    process.exit(0)
  }

  const latitude = company.latitude ?? -2.7955
  const longitude = company.longitude ?? -40.5128

  for (const employee of employees) {
    const since = dayAt(DAYS_OF_HISTORY, 0, 0)
    const existingCount = await prisma.timeEntry.count({ where: { userId: employee.id, createdAt: { gte: since } } })
    if (existingCount > 0) {
      console.log(`↷ ${employee.name}: já tem ${existingCount} batidas nos últimos ${DAYS_OF_HISTORY} dias — pulando.`)
      continue
    }

    const workStartTime = employee.employeeProfile?.workStartTime ?? "08:00"
    const workEndTime = employee.employeeProfile?.workEndTime ?? "18:00"

    const { lateDays, overtimeDays, bankDelta } = await seedEmployeeTimeclock({
      companyId: company.id,
      employeeId: employee.id,
      latitude,
      longitude,
      workStartTime,
      workEndTime,
    })
    console.log(`✓ ${employee.name}: ${lateDays} dia(s) com atraso, ${overtimeDays} dia(s) com hora extra (saldo ${bankDelta >= 0 ? "+" : ""}${bankDelta}min)`)

    const compensatory = await seedCompensatoryDayOff(company.id, employee.id, master.id)
    if (compensatory) console.log(`  ↳ Folga Compensatória concedida (8h abatidas do Banco de Horas)`)
  }

  console.log("\nConcluído.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
