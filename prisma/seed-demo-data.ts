/**
 * Dados PROVISÓRIOS/FICTÍCIOS para alimentar dashboards enquanto os dados
 * reais não chegam: mais 2 colaboradores por empresa (equipe real de 1
 * pessoa não rende ranking/mapa de risco), ~10 dias de ponto + checklist +
 * nota diária + XP, ocorrências variadas, fechamentos de caixa, metas de
 * faturamento, comandas/comissões do parceiro de teste e posts de mural.
 *
 * Uso: npm run db:seed-demo (roda depois de scripts/seed.mjs).
 *
 * Idempotência: cada empresa só recebe a série histórica (ponto/checklist/
 * nota/ocorrência/fechamento/comandas) se ainda não tiver nenhum
 * ShiftClosing — rodar de novo não duplica. Colaboradores extras, programa
 * de níveis, promoção e metas usam upsert/guard próprios, então também são
 * seguros de repetir.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createClient } from "@supabase/supabase-js"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = "123456"
const PLACEHOLDER_PHOTO = "https://placehold.co/800x600/F58220/FFFFFF?text=Demo"
const DAYS_OF_HISTORY = 10

// listUsers() pagina 50 por padrão — com 150+ contas no projeto, precisa varrer todas as páginas.
async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 200) return null
  }
  return null
}

async function createOrGetAuthUser(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error || !data.user) {
    if (error?.message.includes("already been registered") || error?.status === 422) {
      const existing = await findAuthUserByEmail(email)
      if (existing) return existing
    }
    throw error
  }
  return data.user
}

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
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function jitter(coord: number) {
  return coord + rand(-0.0004, 0.0004) // ~±45m — cosmético, não passa por validação de geofence aqui
}

const CLIENT_NAMES = ["Marina Alves", "Felipe Rocha", "Beatriz Nunes", "Diego Martins", "Larissa Farias", "Renata Vieira", "Otávio Lins", "Camila Braga"]
const EVAL_JUSTIFICATIONS_POSITIVE = ["Superou a meta de atendimentos do turno", "Resolveu uma reclamação difícil com muito jogo de cintura", "Ajudou a treinar o colega novo"]
const EVAL_JUSTIFICATIONS_NEGATIVE = ["Chegou 20min atrasado sem avisar", "Esqueceu de fechar o checklist de abertura", "Reclamação de cliente por demora no atendimento"]

const COMPANY_CONFIGS: {
  slug: string
  extraEmployees: { email: string; name: string }[]
  promotion: { title: string; description: string; cost: number }
}[] = [
  {
    slug: "nomads-jeri",
    extraEmployees: [
      { email: "ana.jeri@teste.com.vc", name: "Ana Beatriz Souza" },
      { email: "rafael.jeri@teste.com.vc", name: "Rafael Torres" },
    ],
    promotion: { title: "Happy Hour Nomad's Jeri", description: "20% de desconto em drinks das 17h às 19h", cost: 28 },
  },
  {
    slug: "nomads-lagoa",
    extraEmployees: [
      { email: "marina.lagoa@teste.com.vc", name: "Marina Duarte" },
      { email: "lucas.lagoa@teste.com.vc", name: "Lucas Prado" },
    ],
    promotion: { title: "Combo Lagoa da Conceição", description: "Prato principal + caipirinha", cost: 22 },
  },
  {
    slug: "in-on",
    extraEmployees: [
      { email: "camila.inon@teste.com.vc", name: "Camila Rocha" },
      { email: "thiago.inon@teste.com.vc", name: "Thiago Nunes" },
    ],
    promotion: { title: "Menu Degustação IN-ON", description: "Menu fechado para até 4 pessoas", cost: 35 },
  },
]

async function ensureEmployee(companyId: string, email: string, name: string) {
  const authUser = await createOrGetAuthUser(email)
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { name, role: "EMPLOYEE", companyId },
    create: { id: authUser.id, email, name, role: "EMPLOYEE", companyId },
  })
  await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, isScannerOnly: false, monthlySalary: Math.round(rand(2200, 2900)) },
  })
  return user
}

async function ensureChecklistTemplates(companyId: string, createdById: string) {
  const existing = await prisma.checklistTemplate.findMany({ where: { companyId } })
  const byTitle = new Map(existing.map((t) => [t.title, t]))

  const wanted = [
    { title: "Checar freezer", priority: "HIGH" as const, dueTime: "20:00" },
    { title: "Organizar salão", priority: "MEDIUM" as const, dueTime: "22:00" },
  ]

  const templates = []
  for (const w of wanted) {
    let t = byTitle.get(w.title)
    if (!t) {
      t = await prisma.checklistTemplate.create({
        data: { companyId, title: w.title, recurrence: "DAILY", priority: w.priority, dueTime: w.dueTime, createdById },
      })
    }
    templates.push(t)
  }
  return templates
}

async function ensurePromotion(companyId: string, cfg: { title: string; description: string; cost: number }) {
  const existing = await prisma.promotion.findFirst({ where: { companyId } })
  if (existing) return existing
  return prisma.promotion.create({
    data: {
      companyId,
      title: cfg.title,
      description: cfg.description,
      validFrom: new Date(new Date().getFullYear(), 0, 1),
      validUntil: new Date(new Date().getFullYear() + 1, 0, 1),
      cost: cfg.cost,
      active: true,
    },
  })
}

async function ensureGoalTiers(companyId: string, createdById: string) {
  const existing = await prisma.goal.findFirst({ where: { companyId, scope: "COMPANY", period: "DAILY" } })
  if (existing) return
  await prisma.goal.create({
    data: {
      companyId,
      scope: "COMPANY",
      period: "DAILY",
      name: "Meta Diária de Faturamento",
      createdById,
      tiers: {
        create: [
          { order: 0, targetAmount: 5000, bonusAmount: 30 },
          { order: 1, targetAmount: 7500, bonusAmount: 50 },
          { order: 2, targetAmount: 10000, bonusAmount: 80 },
        ],
      },
    },
  })
}

async function ensureMuralPosts(companyId: string, masterId: string, employeeId: string) {
  const existing = await prisma.post.count({ where: { companyId } })
  if (existing > 0) return
  await prisma.post.create({
    data: {
      companyId,
      authorId: masterId,
      title: "Bem-vindos ao mural!",
      content: "A partir de hoje vamos usar este espaço para avisos, elogios e novidades da equipe. Fiquem à vontade para curtir e comentar 🙂",
      status: "PUBLISHED",
      publishedAt: dayAt(3, 9, 0),
      reviewedById: masterId,
      reviewedAt: dayAt(3, 9, 0),
      createdAt: dayAt(3, 9, 0),
    },
  })
  await prisma.post.create({
    data: {
      companyId,
      authorId: employeeId,
      title: "Sugestão de cardápio",
      content: "Que tal incluirmos uma opção de drink sem álcool no cardápio de verão?",
      status: "PENDING_APPROVAL",
      createdAt: dayAt(1, 15, 30),
    },
  })
}

/** Gera ~DAYS_OF_HISTORY dias de ponto, checklist e nota diária para um colaborador, retorna XP total gerado. */
async function seedEmployeeHistory(params: {
  companyId: string
  employeeId: string
  evaluatorId: string
  templates: { id: string; title: string; priority: "LOW" | "MEDIUM" | "HIGH"; dueTime: string }[]
  latitude: number
  longitude: number
}) {
  const { companyId, employeeId, evaluatorId, templates, latitude, longitude } = params
  let xpTotal = 0

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 1; daysAgo--) {
    // Ponto: 4 batidas do dia
    const checkIn = dayAt(daysAgo, 8, Math.round(rand(45, 59)))
    const breakStart = dayAt(daysAgo, 13, Math.round(rand(0, 15)))
    const breakEnd = dayAt(daysAgo, 14, Math.round(rand(0, 10)))
    const checkOut = dayAt(daysAgo, 18, Math.round(rand(0, 40)))

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
    xpTotal += 5 // ATTENDANCE

    // Nota diária — a maioria neutra, ~1 em 4 dias um destaque com justificativa
    const isOutlier = daysAgo % 4 === 0
    const score = isOutlier ? pick([2, -2]) : Math.round(rand(-1, 1) * 2) / 2
    const justification = isOutlier ? pick(score > 0 ? EVAL_JUSTIFICATIONS_POSITIVE : EVAL_JUSTIFICATIONS_NEGATIVE) : null
    await prisma.dailyEvaluation.upsert({
      where: { employeeId_date: { employeeId, date: startOfDay(checkIn) } },
      update: {},
      create: { companyId, employeeId, date: startOfDay(checkIn), score, justification, evaluatedById: evaluatorId, createdAt: dayAt(daysAgo, 19, 0) },
    })
    xpTotal += Math.round(score * 5)

    // Checklist — em ~70% dos dias, 1 execução com foto
    if (Math.random() < 0.7) {
      const template = pick(templates)
      const [h, m] = template.dueTime.split(":").map(Number)
      const dueAt = dayAt(daysAgo, h, m)
      const onTime = Math.random() < 0.75
      const approvedAt = onTime ? new Date(dueAt.getTime() - rand(10, 90) * 60000) : new Date(dueAt.getTime() + rand(10, 90) * 60000)
      const rejected = Math.random() < 0.1
      const status = rejected ? "REJECTED" : "APPROVED"

      await prisma.checklist.create({
        data: {
          companyId,
          templateId: template.id,
          employeeId,
          title: template.title,
          photoUrl: PLACEHOLDER_PHOTO,
          priority: template.priority,
          dueAt,
          status,
          approvedById: evaluatorId,
          approvedAt,
          createdAt: new Date(dueAt.getTime() - rand(30, 180) * 60000),
        },
      })
      xpTotal += rejected ? -3 : onTime ? 5 : 0
    }
  }

  return xpTotal
}

async function seedOccurrences(companyId: string, masterId: string, employees: { id: string; name: string }[]) {
  const [empA, empB] = employees
  const rows: { employeeId: string; type: string; date: Date; value?: number; description?: string; attachmentUrl?: string; discountWaived?: boolean }[] = [
    { employeeId: empA.id, type: "VALE", date: dayAt(6, 10, 0), value: 100, description: "Vale adiantamento quinzenal" },
    { employeeId: empB.id, type: "HORA_EXTRA", date: dayAt(5, 22, 0), value: 45, description: "Cobertura de fechamento" },
    { employeeId: empA.id, type: "FOLGA_FERIADO", date: dayAt(4, 0, 0), description: "Folga compensatória" },
    {
      employeeId: empB.id,
      type: "ADVERTENCIA",
      date: dayAt(3, 16, 0),
      description: "Atraso reincidente na semana",
      attachmentUrl: PLACEHOLDER_PHOTO,
    },
  ]

  for (const r of rows) {
    const created = await prisma.occurrence.create({
      data: {
        companyId,
        employeeId: r.employeeId,
        type: r.type as never,
        date: r.date,
        value: r.value ?? null,
        total: r.value ?? null,
        description: r.description ?? null,
        attachmentUrl: r.attachmentUrl ?? null,
        createdById: masterId,
      },
    })
    if (r.type === "ADVERTENCIA") {
      await prisma.xpEntry.create({
        data: { companyId, employeeId: r.employeeId, reason: "OCCURRENCE_PENALTY", points: -10, sourceId: created.id, note: "Advertência registrada" },
      })
      await prisma.employeeProfile.update({ where: { userId: r.employeeId }, data: { xpPoints: { decrement: 10 } } })
    }
  }

  // Demonstra o abate automático de FALTA + abono por ATESTADO no mesmo dia
  const faltaDate = dayAt(2, 0, 0)
  const profile = await prisma.employeeProfile.findUnique({ where: { userId: empA.id } })
  const dailyRate = profile?.monthlySalary ? -(Number(profile.monthlySalary) / 30) : null
  const falta = await prisma.occurrence.create({
    data: {
      companyId,
      employeeId: empA.id,
      type: "FALTA",
      date: faltaDate,
      value: dailyRate,
      total: dailyRate,
      createdById: masterId,
      discountWaived: true,
    },
  })
  await prisma.occurrence.create({
    data: {
      companyId,
      employeeId: empA.id,
      type: "ATESTADO",
      date: faltaDate,
      attachmentUrl: PLACEHOLDER_PHOTO,
      description: "Atestado médico enviado no mesmo dia — falta abonada",
      createdById: masterId,
      createdAt: new Date(faltaDate.getTime() + 3 * 3600000),
    },
  })
  void falta
}

async function seedShiftClosings(companyId: string, closedById: string) {
  for (let daysAgo = 6; daysAgo >= 1; daysAgo--) {
    await prisma.shiftClosing.upsert({
      where: { companyId_date: { companyId, date: startOfDay(dayAt(daysAgo, 0, 0)) } },
      update: {},
      create: {
        companyId,
        date: startOfDay(dayAt(daysAgo, 0, 0)),
        revenueAmount: Math.round(rand(3500, 9500)),
        receiptUrl: PLACEHOLDER_PHOTO,
        summary: pick(["Movimento tranquilo, sem intercorrências.", "Casa cheia no jantar, tudo certo no fechamento.", "Fechamento normal, um cliente pediu reembolso de um prato."]),
        status: "COMPLETED",
        closedById,
        closedAt: dayAt(daysAgo, 23, 10),
      },
    })
  }
}

async function seedPartnerCommissions(companyId: string, promotionId: string, scannedById: string, partnerId: string) {
  const statuses: ("PENDING" | "APPROVED" | "PAID")[] = ["PENDING", "APPROVED", "PAID", "APPROVED"]
  const promotion = await prisma.promotion.findUniqueOrThrow({ where: { id: promotionId } })

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i]
    const daysAgo = i === 0 ? 0 : Math.round(rand(1, 8)) // uma comanda de hoje alimenta a "meta do dia"
    const amount = Math.round(rand(120, 480))
    const commission = await prisma.commission.create({
      data: {
        companyId,
        partnerId,
        promotionId,
        scannedById,
        clientName: pick(CLIENT_NAMES),
        customerPhone: `8599${Math.floor(rand(1000000, 9999999))}`,
        qrCodeId: crypto.randomUUID(),
        amount,
        commissionValue: Number(promotion.cost),
        status,
        acceptedAt: dayAt(daysAgo, 20, 0),
        billAttachmentUrl: PLACEHOLDER_PHOTO,
        date: dayAt(daysAgo, 20, 0),
        createdAt: dayAt(daysAgo, 20, 0),
      },
    })

    if (status === "APPROVED" || status === "PAID") {
      await prisma.partnerProfile.update({ where: { userId: partnerId }, data: { walletBalance: { increment: Number(promotion.cost) } } })
      await prisma.walletTransaction.create({
        data: {
          companyId,
          partnerId,
          type: "COMMISSION",
          amount: Number(promotion.cost),
          description: `Comissão aprovada — ${commission.clientName}`,
          status: "COMPLETED",
          createdAt: dayAt(daysAgo, 20, 5),
        },
      })
    }
  }
}

async function main() {
  console.log("Semeando dados provisórios de demonstração...\n")

  const partner = await prisma.user.findUnique({ where: { email: "parceiro@teste.com.vc" } })
  if (!partner) {
    console.error("Parceiro de teste não encontrado — rode `node scripts/seed.mjs` primeiro.")
    process.exit(1)
  }

  // Régua de nível do parceiro (Prata/Ouro/Diamante) num programa da Nomad's Jeri
  const jeri = await prisma.company.findUniqueOrThrow({ where: { slug: "nomads-jeri" } })
  let program = await prisma.program.findFirst({ where: { companyId: jeri.id } })
  if (!program) {
    const master = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, role: "COMPANY_MASTER" } })
    program = await prisma.program.create({
      data: {
        companyId: jeri.id,
        name: "Programa de Indicações",
        description: "Régua de comissão por volume de indicações",
        commissionType: "VARIABLE",
        commissionValue: 10,
        isPercentage: true,
        hasLevels: true,
        active: true,
      },
    })
    const levels = [
      { name: "Prata", order: 0, commissionPercentage: 8, requiredReferralCount: 3, periodMonths: 12, badgeColorHex: "#B7C0C7" },
      { name: "Ouro", order: 1, commissionPercentage: 12, requiredReferralCount: 10, periodMonths: 12, badgeColorHex: "#E3B341" },
      { name: "Diamante", order: 2, commissionPercentage: 18, requiredReferralCount: 25, periodMonths: 12, badgeColorHex: "#7DD3E8", bonusDescription: "Brinde exclusivo + prioridade de reserva" },
    ]
    for (const l of levels) await prisma.programLevel.create({ data: { programId: program.id, ...l } })
    void master
  }
  const prataLevel = await prisma.programLevel.findFirstOrThrow({ where: { programId: program.id, order: 0 } })
  await prisma.partnerProfile.update({ where: { userId: partner.id }, data: { currentLevelId: prataLevel.id, pixKey: partner.email } })
  console.log(`✓ Régua de nível do parceiro configurada (Prata/Ouro/Diamante) — ${jeri.name}`)

  for (const cfg of COMPANY_CONFIGS) {
    const company = await prisma.company.findUniqueOrThrow({ where: { slug: cfg.slug } })
    const master = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "COMPANY_MASTER" } })
    const gerente = await prisma.user.findFirst({ where: { companyId: company.id, role: "COMPANY_GERENTE" } })
    const evaluatorId = (gerente ?? master).id
    const existingEmployee = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "EMPLOYEE" }, orderBy: { createdAt: "asc" } })

    const newEmployees = []
    for (const e of cfg.extraEmployees) {
      newEmployees.push(await ensureEmployee(company.id, e.email, e.name))
    }
    const allEmployees = [existingEmployee, ...newEmployees]
    console.log(`✓ ${company.name}: ${allEmployees.length} colaboradores (${newEmployees.length} novos)`)

    const templates = await ensureChecklistTemplates(company.id, master.id)
    const promotion = await ensurePromotion(company.id, cfg.promotion)
    await ensureGoalTiers(company.id, master.id)
    await ensureMuralPosts(company.id, master.id, existingEmployee.id)

    // Limite alto (o script sempre cria 6 de uma vez) pra não confundir um único
    // fechamento manual de teste anterior com "esta empresa já foi semeada".
    const alreadySeeded = (await prisma.shiftClosing.count({ where: { companyId: company.id } })) >= 5
    if (alreadySeeded) {
      console.log(`↷ ${company.name}: já tem histórico de fechamento — pulando série temporal (ponto/checklist/ocorrências).`)
      continue
    }

    for (const employee of allEmployees) {
      const xp = await seedEmployeeHistory({
        companyId: company.id,
        employeeId: employee.id,
        evaluatorId,
        templates,
        latitude: company.latitude!,
        longitude: company.longitude!,
      })
      await prisma.employeeProfile.update({ where: { userId: employee.id }, data: { xpPoints: { increment: xp } } })
      console.log(`  · ${employee.name}: ${DAYS_OF_HISTORY} dias de ponto/nota/checklist (+${xp} XP)`)
    }

    await seedOccurrences(company.id, master.id, allEmployees)
    await seedShiftClosings(company.id, evaluatorId)
    await seedPartnerCommissions(company.id, promotion.id, existingEmployee.id, partner.id)

    // Resgate de prêmio pendente, pra Loja de Prêmios não ficar vazia
    const reward = await prisma.rewardCatalogItem.findFirst({ where: { companyId: company.id } })
    const richestEmployee = newEmployees[0]
    if (reward && richestEmployee) {
      const profile = await prisma.employeeProfile.findUnique({ where: { userId: richestEmployee.id } })
      if (profile && profile.xpPoints >= reward.costXp) {
        await prisma.rewardRedemption.create({
          data: { companyId: company.id, itemId: reward.id, employeeId: richestEmployee.id, costXp: reward.costXp, status: "PENDING" },
        })
        await prisma.employeeProfile.update({ where: { userId: richestEmployee.id }, data: { xpPoints: { decrement: reward.costXp } } })
        await prisma.xpEntry.create({
          data: { companyId: company.id, employeeId: richestEmployee.id, reason: "REWARD_REDEMPTION", points: -reward.costXp, note: `Resgate: ${reward.name}` },
        })
      }
    }

    console.log(`✓ ${company.name}: ocorrências, fechamentos e comandas do parceiro semeados\n`)
  }

  console.log("Concluído. Login de colaborador pronto para uso:")
  console.log("  colaborador@teste.com.vc / 123456 (Nomad's Jeri)")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
