/**
 * Simulação de dados do PROGRAMA INTERNO DE COLABORADORES, PROGRAMA DE
 * PARCERIA, SETORES/TURNOS/BANCO DE HORAS e METAS ESCALONADAS — para
 * visualização imediata em Nomad's Jeri, Nomad's Lagoa e IN-ON.
 *
 * Uso: npm run db:seed-simulation (rode depois de db:seed-demo).
 *
 * Idempotência: configs (InternalProgram, Program, Sector) usam upsert;
 * réguas de nível e registros de meta usam upsert pela chave única
 * ([internalProgramId,order] / [goalId,date]) — rodar de novo não duplica.
 *
 * Decisão deliberada: o colaborador principal de demo
 * (colaborador@teste.com.vc) e o parceiro de teste (parceiro@teste.com.vc)
 * são deixados SEM aceite de termo, para que o modal bloqueante de aceite
 * apareça ao logar com essas contas — os demais colaboradores já entram
 * com o termo aceito, para não exigir interação extra em cada conta ao
 * explorar ranking/ONBOARDING dos demais dashboards.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const PLACEHOLDER_IMAGE = "https://placehold.co/1200x630/F58220/FFFFFF?text=Tribuss"
const PLACEHOLDER_DOC = "https://placehold.co/600x800/3E2415/FFFFFF?text=Termo+PDF"
const DAYS_OF_GOAL_HISTORY = 15

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
function startOfMonth(date: Date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const SECTOR_DEFS = [
  { name: "Atendimento", description: "Salão, recepção de clientes e bar" },
  { name: "Cozinha", description: "Preparo, expedição e controle de estoque" },
  { name: "Recepção", description: "Reservas, check-in de hóspedes e concierge" },
]

const LEVEL_LADDER = [
  { name: "Trainee", order: 0, pointsRequired: 100, salaryIncreasePercent: 0, bonusDescription: "Kit boas-vindas Tribuss", bonusAmount: 0, badgeColorHex: "#B7C0C7" },
  { name: "Auxiliar", order: 1, pointsRequired: 150, salaryIncreasePercent: 5, bonusDescription: "Vale-refeição +R$50/mês", bonusAmount: 50, badgeColorHex: "#8DBE6C" },
  { name: "Operador", order: 2, pointsRequired: 200, salaryIncreasePercent: 10, bonusDescription: "Day off extra no mês", bonusAmount: 100, badgeColorHex: "#4FA3D1" },
  { name: "Especialista", order: 3, pointsRequired: 250, salaryIncreasePercent: 15, bonusDescription: "Bônus de performance trimestral", bonusAmount: 180, badgeColorHex: "#E3B341" },
  { name: "Supervisor", order: 4, pointsRequired: 300, salaryIncreasePercent: 20, bonusDescription: "Participação nos resultados", bonusAmount: 300, badgeColorHex: "#F2680C" },
]

const PARTNER_LEVEL_LADDER = [
  { name: "Prata", order: 0, commissionPercentage: 8, requiredReferralCount: 3, periodMonths: 12, badgeColorHex: "#B7C0C7" },
  { name: "Ouro", order: 1, commissionPercentage: 12, requiredReferralCount: 10, periodMonths: 12, badgeColorHex: "#E3B341" },
  { name: "Diamante", order: 2, commissionPercentage: 18, requiredReferralCount: 25, periodMonths: 12, badgeColorHex: "#7DD3E8", bonusDescription: "Brinde exclusivo + prioridade de reserva" },
]

const COMPANY_SIM_CONFIGS: {
  slug: string
  internalProgram: { title: string; description: string; measurementPeriod: "MONTHLY" | "SEMIANNUAL" | "ANNUAL" }
  partnerProgram: { name: string; description: string }
  sectorGoal: { name: string; tiers: [number, number][] }
  employeeGoal: { name: string; tiers: [number, number][] }
}[] = [
  {
    slug: "nomads-jeri",
    internalProgram: {
      title: "Trilha de Crescimento Nomad's Jeri",
      description: "Programa interno de pontuação, bônus de eficiência e plano de carreira da equipe de Jericoacoara.",
      measurementPeriod: "MONTHLY",
    },
    partnerProgram: { name: "Programa de Parceria Nomad's Jeri", description: "Régua de comissão por volume de indicações em Jericoacoara" },
    sectorGoal: { name: "Meta de Vendas — Cozinha", tiers: [[15000, 80], [20000, 120], [25000, 160]] },
    employeeGoal: { name: "Meta Individual de Atendimentos", tiers: [[10, 15], [15, 25], [20, 40]] },
  },
  {
    slug: "nomads-lagoa",
    internalProgram: {
      title: "Trilha de Crescimento Nomad's Lagoa",
      description: "Programa interno de pontuação, bônus de eficiência e plano de carreira da equipe da Lagoa da Conceição.",
      measurementPeriod: "SEMIANNUAL",
    },
    partnerProgram: { name: "Programa de Parceria Nomad's Lagoa", description: "Régua de comissão por volume de indicações na Lagoa da Conceição" },
    sectorGoal: { name: "Meta de Vendas — Cozinha", tiers: [[12000, 70], [16000, 110], [20000, 150]] },
    employeeGoal: { name: "Meta Individual de Atendimentos", tiers: [[8, 12], [12, 20], [18, 35]] },
  },
  {
    slug: "in-on",
    internalProgram: {
      title: "Trilha de Crescimento IN-ON",
      description: "Programa interno de pontuação, bônus de eficiência e plano de carreira da equipe IN-ON.",
      measurementPeriod: "ANNUAL",
    },
    partnerProgram: { name: "Programa de Parceria IN-ON", description: "Régua de comissão por volume de indicações IN-ON" },
    sectorGoal: { name: "Meta de Vendas — Cozinha", tiers: [[10000, 60], [14000, 100], [18000, 140]] },
    employeeGoal: { name: "Meta Individual de Atendimentos", tiers: [[8, 12], [12, 20], [16, 30]] },
  },
]

const INTERNAL_TERMS_CONTENT = `## Termo de Aceite — Programa Interno de Colaboradores

Ao aceitar este termo, você concorda com as regras de pontuação, bônus de eficiência e plano de carreira descritas neste programa.

- Pontos são somados por pontualidade, checklists no prazo e avaliações diárias.
- Ocorrências (advertências) descontam pontos.
- A cada promoção de cargo, sua pontuação é reiniciada e um novo ciclo de crescimento começa.

Dúvidas: fale com sua Gerência.`

const PARTNER_TERMS_CONTENT = `## Termo de Aceite — Programa de Parceria

Ao aceitar este termo, você concorda com as regras de comissão e a régua de níveis (Prata/Ouro/Diamante) deste programa.

- Comissão calculada sobre cada indicação convertida em comanda paga.
- O nível sobe automaticamente conforme o volume de indicações no período.
- Pagamento via PIX, mediante solicitação de saque na carteira.

Dúvidas: fale com a equipe da empresa parceira.`

async function ensureInternalProgram(companyId: string, cfg: (typeof COMPANY_SIM_CONFIGS)[number]["internalProgram"]) {
  const program = await prisma.internalProgram.upsert({
    where: { companyId },
    update: {
      title: cfg.title,
      description: cfg.description,
      imageUrl: PLACEHOLDER_IMAGE,
      pdfUrl: PLACEHOLDER_DOC,
      termsContent: INTERNAL_TERMS_CONTENT,
      measurementPeriod: cfg.measurementPeriod,
      minEfficiencyPercent: 90,
      efficiencyBonusAmount: 120,
    },
    create: {
      companyId,
      title: cfg.title,
      description: cfg.description,
      imageUrl: PLACEHOLDER_IMAGE,
      pdfUrl: PLACEHOLDER_DOC,
      termsContent: INTERNAL_TERMS_CONTENT,
      measurementPeriod: cfg.measurementPeriod,
      minEfficiencyPercent: 90,
      efficiencyBonusAmount: 120,
    },
  })

  const levels = []
  for (const l of LEVEL_LADDER) {
    const level = await prisma.internalLevelRule.upsert({
      where: { internalProgramId_order: { internalProgramId: program.id, order: l.order } },
      update: {
        name: l.name,
        pointsRequired: l.pointsRequired,
        salaryIncreasePercent: l.salaryIncreasePercent,
        bonusDescription: l.bonusDescription,
        bonusAmount: l.bonusAmount,
        badgeColorHex: l.badgeColorHex,
        imageUrl: PLACEHOLDER_IMAGE,
      },
      create: {
        internalProgramId: program.id,
        name: l.name,
        order: l.order,
        pointsRequired: l.pointsRequired,
        salaryIncreasePercent: l.salaryIncreasePercent,
        bonusDescription: l.bonusDescription,
        bonusAmount: l.bonusAmount,
        badgeColorHex: l.badgeColorHex,
        imageUrl: PLACEHOLDER_IMAGE,
      },
    })
    levels.push(level)
  }
  return { program, levels }
}

async function ensurePartnerProgram(companyId: string, cfg: (typeof COMPANY_SIM_CONFIGS)[number]["partnerProgram"]) {
  let program = await prisma.program.findUnique({ where: { companyId } })
  if (!program) {
    program = await prisma.program.create({
      data: {
        companyId,
        name: cfg.name,
        description: cfg.description,
        commissionType: "VARIABLE",
        commissionValue: 10,
        commissionFormat: "PERCENTAGE",
        hasLevels: true,
        active: true,
        imageUrl: PLACEHOLDER_IMAGE,
        pdfUrl: PLACEHOLDER_DOC,
        termsContent: PARTNER_TERMS_CONTENT,
      },
    })
    for (const l of PARTNER_LEVEL_LADDER) {
      await prisma.programLevel.create({ data: { programId: program.id, ...l } })
    }
  } else {
    program = await prisma.program.update({
      where: { id: program.id },
      data: { imageUrl: PLACEHOLDER_IMAGE, pdfUrl: PLACEHOLDER_DOC, termsContent: PARTNER_TERMS_CONTENT },
    })
  }
  return program
}

async function ensureSectors(companyId: string) {
  const sectors = []
  for (const s of SECTOR_DEFS) {
    const sector = await prisma.sector.upsert({
      where: { companyId_name: { companyId, name: s.name } },
      update: { description: s.description },
      create: { companyId, name: s.name, description: s.description },
    })
    sectors.push(sector)
  }
  return sectors
}

const SHIFT_WINDOWS = {
  DAY: { workStartTime: "08:00", workEndTime: "17:00", breakStartTime: "12:00", breakEndTime: "13:00" },
  NIGHT: { workStartTime: "17:00", workEndTime: "23:59", breakStartTime: "20:00", breakEndTime: "20:30" },
} as const

async function assignSchedules(employees: { id: string }[], sectors: { id: string }[]) {
  for (let i = 0; i < employees.length; i++) {
    const sector = sectors[i % sectors.length]
    const shiftType: "DAY" | "NIGHT" = i % 2 === 0 ? "DAY" : "NIGHT"
    const window = SHIFT_WINDOWS[shiftType]
    const bankOfHoursMinutes = Math.round(pick([rand(-90, -10), rand(10, 140)]))
    await prisma.employeeProfile.update({
      where: { userId: employees[i].id },
      data: { sectorId: sector.id, shiftType, ...window, bankOfHoursMinutes },
    })
  }
}

async function promoteEmployees(employees: { id: string }[], levels: { id: string; order: number; pointsRequired: number }[]) {
  const targets = [
    { employee: employees[0], levelOrder: 2, progressRatio: 0.6 },
    { employee: employees[1], levelOrder: 1, progressRatio: 0.35 },
  ].filter((t) => t.employee)

  for (const t of targets) {
    const level = levels.find((l) => l.order === t.levelOrder)
    if (!level) continue
    const xpPoints = Math.round(level.pointsRequired * t.progressRatio)
    await prisma.employeeProfile.update({
      where: { userId: t.employee.id },
      data: { currentInternalLevelId: level.id, xpPoints },
    })
  }
}

async function ensureCompanyDailyGoal(companyId: string, createdById: string) {
  let goal = await prisma.goal.findFirst({ where: { companyId, scope: "COMPANY", period: "DAILY" } })
  if (!goal) {
    goal = await prisma.goal.create({
      data: {
        companyId,
        scope: "COMPANY",
        period: "DAILY",
        name: "Meta Diária de Faturamento",
        createdById,
        tiers: { create: [{ order: 0, targetAmount: 5000, bonusAmount: 30 }, { order: 1, targetAmount: 7500, bonusAmount: 50 }, { order: 2, targetAmount: 10000, bonusAmount: 80 }] },
      },
    })
  }
  for (let daysAgo = DAYS_OF_GOAL_HISTORY; daysAgo >= 1; daysAgo--) {
    const date = startOfDay(dayAt(daysAgo, 0, 0))
    await prisma.goalRecord.upsert({
      where: { goalId_date: { goalId: goal.id, date } },
      update: {},
      create: { goalId: goal.id, date, amount: Math.round(rand(3500, 9800)), receiptUrl: PLACEHOLDER_DOC, reportedById: createdById },
    })
  }
  return goal
}

async function ensureSectorGoal(companyId: string, sectorId: string, createdById: string, cfg: (typeof COMPANY_SIM_CONFIGS)[number]["sectorGoal"]) {
  let goal = await prisma.goal.findFirst({ where: { companyId, scope: "SECTOR", sectorId, period: "MONTHLY" } })
  if (!goal) {
    goal = await prisma.goal.create({
      data: {
        companyId,
        scope: "SECTOR",
        sectorId,
        period: "MONTHLY",
        name: cfg.name,
        createdById,
        tiers: { create: cfg.tiers.map(([targetAmount, bonusAmount], order) => ({ order, targetAmount, bonusAmount })) },
      },
    })
  }
  const monthStart = startOfMonth(new Date())
  const today = new Date()
  const daysIntoMonth = Math.min(DAYS_OF_GOAL_HISTORY, today.getDate())
  for (let d = 0; d < daysIntoMonth; d++) {
    const date = startOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth(), d + 1))
    if (date > today) break
    await prisma.goalRecord.upsert({
      where: { goalId_date: { goalId: goal.id, date } },
      update: {},
      create: { goalId: goal.id, date, amount: Math.round(rand(600, 1400)), reportedById: createdById },
    })
  }
  return goal
}

async function ensureEmployeeGoal(companyId: string, employeeId: string, createdById: string, cfg: (typeof COMPANY_SIM_CONFIGS)[number]["employeeGoal"]) {
  let goal = await prisma.goal.findFirst({ where: { companyId, scope: "EMPLOYEE", employeeId, period: "DAILY" } })
  if (!goal) {
    goal = await prisma.goal.create({
      data: {
        companyId,
        scope: "EMPLOYEE",
        employeeId,
        period: "DAILY",
        name: cfg.name,
        createdById,
        tiers: { create: cfg.tiers.map(([targetAmount, bonusAmount], order) => ({ order, targetAmount, bonusAmount })) },
      },
    })
  }
  for (let daysAgo = DAYS_OF_GOAL_HISTORY; daysAgo >= 1; daysAgo--) {
    const date = startOfDay(dayAt(daysAgo, 0, 0))
    await prisma.goalRecord.upsert({
      where: { goalId_date: { goalId: goal.id, date } },
      update: {},
      create: { goalId: goal.id, date, amount: Math.round(rand(6, 24)), reportedById: createdById },
    })
  }
  return goal
}

async function seedTermAcceptances(employees: { id: string }[], internalProgramId: string, skipUserId?: string) {
  for (const e of employees) {
    if (e.id === skipUserId) continue
    await prisma.employeeTermAcceptance.upsert({
      where: { employeeId_internalProgramId: { employeeId: e.id, internalProgramId } },
      update: {},
      create: { employeeId: e.id, internalProgramId, ipAddress: "127.0.0.1" },
    })
  }
}

async function main() {
  console.log("Semeando simulação de Programa Interno / Setores / Metas...\n")

  const partner = await prisma.user.findUnique({ where: { email: "parceiro@teste.com.vc" } })

  for (const cfg of COMPANY_SIM_CONFIGS) {
    const company = await prisma.company.findUniqueOrThrow({ where: { slug: cfg.slug } })
    const master = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "COMPANY_MASTER" } })
    const gerente = await prisma.user.findFirst({ where: { companyId: company.id, role: "COMPANY_GERENTE" } })
    const evaluatorId = (gerente ?? master).id
    const employees = await prisma.user.findMany({ where: { companyId: company.id, role: "EMPLOYEE" }, orderBy: { createdAt: "asc" } })
    if (employees.length === 0) {
      console.log(`↷ ${company.name}: sem colaboradores — rode db:seed-demo primeiro. Pulando.`)
      continue
    }

    const { program: internalProgram, levels } = await ensureInternalProgram(company.id, cfg.internalProgram)
    console.log(`✓ ${company.name}: Programa Interno "${internalProgram.title}" (${levels.length} níveis, medição ${internalProgram.measurementPeriod})`)

    const partnerProgram = await ensurePartnerProgram(company.id, cfg.partnerProgram)
    console.log(`✓ ${company.name}: Programa de Parceria "${partnerProgram.name}" com termo/imagem/PDF`)

    const sectors = await ensureSectors(company.id)
    await assignSchedules(employees, sectors)
    console.log(`✓ ${company.name}: ${sectors.length} setores, turnos e banco de horas atribuídos a ${employees.length} colaboradores`)

    await promoteEmployees(employees, levels)
    console.log(`✓ ${company.name}: promoções de cargo simuladas (pontuação reiniciada no novo nível)`)

    await ensureCompanyDailyGoal(company.id, evaluatorId)
    await ensureSectorGoal(company.id, sectors[1].id, evaluatorId, cfg.sectorGoal) // sectors[1] = Cozinha
    await ensureEmployeeGoal(company.id, employees[0].id, evaluatorId, cfg.employeeGoal)
    console.log(`✓ ${company.name}: metas escalonadas (empresa/setor/colaborador) com ${DAYS_OF_GOAL_HISTORY} dias de histórico`)

    // Conta principal de demo fica sem aceite, pra demonstrar o modal bloqueante ao vivo.
    const mainDemoEmployee = employees.find((e) => e.email === "colaborador@teste.com.vc")
    await seedTermAcceptances(employees, internalProgram.id, mainDemoEmployee?.id)
    console.log(`✓ ${company.name}: aceite de termo simulado (${mainDemoEmployee ? "conta principal de demo deixada pendente" : "todos aceitos"})`)
  }

  if (partner) {
    console.log(`\n↷ Parceiro de teste (${partner.email}) deixado sem aceite de termo, para demonstrar o modal bloqueante do /partner.`)
  }

  console.log("\nConcluído.")
  console.log("  Programa Interno: /company/programa-interno")
  console.log("  Setores: /company/setores")
  console.log("  Metas: /company/metas")
  console.log("  Modal de aceite: logue como colaborador@teste.com.vc ou parceiro@teste.com.vc")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
