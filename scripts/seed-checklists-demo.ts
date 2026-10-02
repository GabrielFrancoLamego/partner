/**
 * Seed de demonstração — 20 tarefas de Checklist reais na Nomad's Jeri,
 * distribuídas entre Gerente e colaboradores, cobrindo as 4 formas de
 * destinatário (Colaborador Específico, Livre, Por Setor, Por Tag) e as 3
 * recorrências (Diária, Semanal, Mensal) — com horários calculados em
 * relação ao momento em que o script roda, pra já nascerem em cada cor do
 * código de urgência (algumas atrasadas, algumas a poucos minutos do prazo,
 * algumas tranquilas) e dar pra testar a troca de cores, reserva ("Vou
 * Fazer"), recusa/reabertura e conclusão na hora.
 *
 * Idempotente: tarefas identificadas por título + "(Demo)" no fim — roda de
 * novo sem duplicar (reaproveita os templates já criados, só atualiza o
 * horário-limite pra ficar com as cores corretas de novo e regenera a
 * instância de hoje).
 *
 * Requer: `npm run dev` rodando (não é usado diretamente, mas o fluxo real
 * usa a mesma lib/checklist-engine.ts) — roda direto com Prisma.
 * Uso: npx tsx scripts/seed-checklists-demo.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
// Não importa lib/checklist-engine.ts aqui de propósito — esse módulo tem
// `import "server-only"`, que só funciona dentro do bundler do Next.js e
// quebra em qualquer execução direta via tsx/node. As instâncias de hoje são
// montadas abaixo com a mesma forma de dados, só sem o motor de reatribuição
// por ausência (dados de demo, colaboradores todos ativos).

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function hhmm(minutesFromNow: number) {
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

async function main() {
  console.log(`\n=== SEED — 20 TAREFAS DE CHECKLIST (NOMAD'S JERI) — ${new Date().toISOString()} ===\n`)

  const jeri = await prisma.company.findFirstOrThrow({ where: { slug: "nomads-jeri" } })
  const master = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, role: "COMPANY_MASTER" } })
  const gerente = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, role: "COMPANY_GERENTE" } })
  const colaborador = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, email: "colaborador@teste.com.vc" } })
  const ana = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, email: "ana.jeri@teste.com.vc" } })
  const rafael = await prisma.user.findFirstOrThrow({ where: { companyId: jeri.id, email: "rafael.jeri@teste.com.vc" } })

  const setorAtendimento = await prisma.sector.findFirstOrThrow({ where: { companyId: jeri.id, name: "Atendimento" } })
  const setorCozinha = await prisma.sector.findFirstOrThrow({ where: { companyId: jeri.id, name: "Cozinha" } })
  const setorRecepcao = await prisma.sector.findFirstOrThrow({ where: { companyId: jeri.id, name: "Recepção" } })

  // Tags demonstrativas — necessárias pra ter alguém elegível nas tarefas TAG.
  await prisma.employeeProfile.update({ where: { userId: ana.id }, data: { tag: "Caixa" } })
  await prisma.employeeProfile.update({ where: { userId: rafael.id }, data: { tag: "Limpeza" } })
  console.log("✓ Tags demonstrativas: Ana=Caixa, Rafael=Limpeza")

  const today = startOfDay()
  const todayDow = today.getDay()
  const todayDom = today.getDate()

  type Def = {
    title: string
    priority: "LOW" | "MEDIUM" | "HIGH"
    recurrence: "DAILY" | "WEEKLY" | "MONTHLY"
    dueMinutesFromNow: number
    requiresApproval?: boolean
    requiresPhoto?: boolean
  } & (
    | { assignmentType: "SPECIFIC"; primaryEmployeeId: string }
    | { assignmentType: "FREE" }
    | { assignmentType: "SECTOR"; targetSectorId: string }
    | { assignmentType: "TAG"; targetTag: string }
  )

  const defs: Def[] = [
    { title: "Abrir o salão e organizar mesas (Demo)", priority: "HIGH", recurrence: "DAILY", dueMinutesFromNow: -20, assignmentType: "SPECIFIC", primaryEmployeeId: ana.id },
    { title: "Checar estoque de bebidas (Demo)", priority: "MEDIUM", recurrence: "DAILY", dueMinutesFromNow: 8, assignmentType: "SPECIFIC", primaryEmployeeId: rafael.id },
    { title: "Repor toalhas e guardanapos (Demo)", priority: "LOW", recurrence: "DAILY", dueMinutesFromNow: 240, assignmentType: "FREE", requiresApproval: false },
    { title: "Vistoria de limpeza da cozinha (Demo)", priority: "HIGH", recurrence: "DAILY", dueMinutesFromNow: -5, assignmentType: "SECTOR", targetSectorId: setorCozinha.id },
    { title: "Conferir reservas do dia (Demo)", priority: "MEDIUM", recurrence: "DAILY", dueMinutesFromNow: 180, assignmentType: "SECTOR", targetSectorId: setorRecepcao.id },
    { title: "Organizar área de caixa (Demo)", priority: "MEDIUM", recurrence: "DAILY", dueMinutesFromNow: 12, assignmentType: "TAG", targetTag: "Caixa" },
    { title: "Limpeza geral das áreas comuns (Demo)", priority: "LOW", recurrence: "DAILY", dueMinutesFromNow: 300, assignmentType: "TAG", targetTag: "Limpeza" },
    { title: "Relatório semanal de vendas (Demo)", priority: "HIGH", recurrence: "WEEKLY", dueMinutesFromNow: 120, assignmentType: "SPECIFIC", primaryEmployeeId: gerente.id },
    { title: "Checklist semanal de equipamentos (Demo)", priority: "MEDIUM", recurrence: "WEEKLY", dueMinutesFromNow: 360, assignmentType: "SECTOR", targetSectorId: setorCozinha.id },
    { title: "Inventário semanal de insumos (Demo)", priority: "HIGH", recurrence: "WEEKLY", dueMinutesFromNow: -45, assignmentType: "FREE" },
    { title: "Avaliação semanal de fornecedores (Demo)", priority: "LOW", recurrence: "WEEKLY", dueMinutesFromNow: 420, assignmentType: "SPECIFIC", primaryEmployeeId: colaborador.id },
    { title: "Treinamento semanal da equipe (Demo)", priority: "MEDIUM", recurrence: "WEEKLY", dueMinutesFromNow: 9, assignmentType: "TAG", targetTag: "Caixa" },
    { title: "Fechamento mensal de caixa (Demo)", priority: "HIGH", recurrence: "MONTHLY", dueMinutesFromNow: 60, assignmentType: "SPECIFIC", primaryEmployeeId: gerente.id },
    { title: "Manutenção preventiva de equipamentos (Demo)", priority: "HIGH", recurrence: "MONTHLY", dueMinutesFromNow: -10, assignmentType: "SECTOR", targetSectorId: setorAtendimento.id },
    { title: "Auditoria mensal de estoque (Demo)", priority: "MEDIUM", recurrence: "MONTHLY", dueMinutesFromNow: 600, assignmentType: "FREE" },
    { title: "Revisão mensal de contratos de fornecedores (Demo)", priority: "LOW", recurrence: "MONTHLY", dueMinutesFromNow: 11, assignmentType: "SPECIFIC", primaryEmployeeId: rafael.id },
    { title: "Reposição de material de limpeza (Demo)", priority: "MEDIUM", recurrence: "DAILY", dueMinutesFromNow: 60, assignmentType: "TAG", targetTag: "Limpeza", requiresApproval: false },
    { title: "Checklist de abertura da recepção (Demo)", priority: "MEDIUM", recurrence: "DAILY", dueMinutesFromNow: -15, assignmentType: "SECTOR", targetSectorId: setorRecepcao.id },
    { title: "Organização do depósito (Demo)", priority: "LOW", recurrence: "DAILY", dueMinutesFromNow: 6, assignmentType: "FREE" },
    { title: "Conferência de caixa do turno (Demo)", priority: "HIGH", recurrence: "DAILY", dueMinutesFromNow: 120, assignmentType: "SPECIFIC", primaryEmployeeId: ana.id },
  ]

  let created = 0
  let updated = 0
  for (const def of defs) {
    const dueTime = hhmm(def.dueMinutesFromNow)
    const base = {
      description: null,
      priority: def.priority,
      recurrence: def.recurrence,
      recurrenceDayOfWeek: def.recurrence === "WEEKLY" ? todayDow : null,
      recurrenceDayOfMonth: def.recurrence === "MONTHLY" ? todayDom : null,
      dueTime,
      requiresPhoto: def.requiresPhoto ?? true,
      requiresApproval: def.requiresApproval ?? true,
      assignmentType: def.assignmentType,
      primaryEmployeeId: def.assignmentType === "SPECIFIC" ? def.primaryEmployeeId : null,
      secondaryEmployeeId: null,
      targetSectorId: def.assignmentType === "SECTOR" ? def.targetSectorId : null,
      targetTag: def.assignmentType === "TAG" ? def.targetTag : null,
    }

    const existing = await prisma.checklistTemplate.findFirst({ where: { companyId: jeri.id, title: def.title } })
    if (existing) {
      await prisma.checklistTemplate.update({ where: { id: existing.id }, data: { ...base, active: true } })
      updated++
    } else {
      await prisma.checklistTemplate.create({ data: { ...base, companyId: jeri.id, title: def.title, createdById: gerente.id } })
      created++
    }
  }
  console.log(`✓ Templates: ${created} criados, ${updated} atualizados (20 no total)`)

  // Remove instâncias de hoje desses templates pra regenerar com o horário
  // recém-atualizado (rerodar o script deve refletir os novos horários nas cores).
  const demoTemplates = await prisma.checklistTemplate.findMany({ where: { companyId: jeri.id, title: { endsWith: "(Demo)" } } })
  await prisma.checklist.deleteMany({ where: { templateId: { in: demoTemplates.map((t) => t.id) }, forDate: today, status: "PENDING" } })

  const combineDateAndTime = (day: Date, time: string) => {
    const [h, m] = time.split(":").map(Number)
    const d = new Date(day)
    d.setHours(h || 0, m || 0, 0, 0)
    return d
  }
  for (const template of demoTemplates) {
    await prisma.checklist.create({
      data: {
        companyId: jeri.id,
        templateId: template.id,
        employeeId: template.assignmentType === "SPECIFIC" ? template.primaryEmployeeId : null,
        targetSectorId: template.assignmentType === "SECTOR" ? template.targetSectorId : null,
        targetTag: template.assignmentType === "TAG" ? template.targetTag : null,
        requiresApproval: template.requiresApproval,
        forDate: today,
        title: template.title,
        notes: template.description,
        priority: template.priority,
        dueAt: combineDateAndTime(today, template.dueTime),
        status: "PENDING",
      },
    })
  }
  console.log(`✓ ${demoTemplates.length} instâncias de hoje geradas (mesma forma de dados do motor de produção)`)

  // Histórico de ontem — pra testar a aba "Histórico Concluído" (no prazo, atrasada e não entregue).
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  await prisma.checklist.deleteMany({ where: { companyId: jeri.id, title: { endsWith: "(Demo - Histórico)" }, forDate: yesterday } })

  const yesterdayDue = (h: number, m: number) => {
    const d = new Date(yesterday)
    d.setHours(h, m, 0, 0)
    return d
  }
  await prisma.checklist.create({
    data: {
      companyId: jeri.id,
      employeeId: ana.id,
      forDate: yesterday,
      title: "Fechamento de caixa do turno (Demo - Histórico)",
      priority: "HIGH",
      dueAt: yesterdayDue(18, 0),
      status: "APPROVED",
      submittedAt: yesterdayDue(17, 40),
      approvedAt: yesterdayDue(17, 45),
      approvedById: gerente.id,
    },
  })
  await prisma.checklist.create({
    data: {
      companyId: jeri.id,
      employeeId: rafael.id,
      forDate: yesterday,
      title: "Checklist de limpeza final (Demo - Histórico)",
      priority: "MEDIUM",
      dueAt: yesterdayDue(17, 0),
      status: "APPROVED",
      submittedAt: yesterdayDue(18, 30),
      approvedAt: yesterdayDue(18, 35),
      approvedById: gerente.id,
    },
  })
  await prisma.checklist.create({
    data: {
      companyId: jeri.id,
      employeeId: colaborador.id,
      forDate: yesterday,
      title: "Reposição de insumos da manhã (Demo - Histórico)",
      priority: "LOW",
      dueAt: yesterdayDue(12, 0),
      status: "REJECTED",
      rejectionReason: "Fechamento do dia sem entrega",
      approvedAt: yesterdayDue(22, 0),
      approvedById: master.id,
    },
  })
  console.log("✓ 3 tarefas de ontem (Demo - Histórico): 1 aprovada no prazo, 1 aprovada atrasada, 1 não entregue")

  console.log("\n=== SEED CONCLUÍDO — 20 tarefas de hoje + 3 de histórico na Nomad's Jeri ===")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
