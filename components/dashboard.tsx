import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, DollarSign, CheckCircle, Users } from 'lucide-react'

const stats = [
  {
    title: 'Indicações do dia',
    value: '24',
    description: '+12% vs. ontem',
    icon: UserPlus,
    color: 'text-primary',
  },
  {
    title: 'Comissões pendentes',
    value: 'R$ 4.250',
    description: '18 transações',
    icon: DollarSign,
    color: 'text-accent',
  },
  {
    title: 'Comissões pagas',
    value: 'R$ 12.840',
    description: 'Este mês',
    icon: CheckCircle,
    color: 'text-secondary',
  },
  {
    title: 'Parceiros ativos',
    value: '87',
    description: '+5 novos esta semana',
    icon: Users,
    color: 'text-primary',
  },
]

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-3xl text-foreground tracking-tight">Dashboard da Empresa</h1>
        <p className="text-muted-foreground mt-1">Resumo geral das indicações e programas</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden shadow-sm transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-semibold text-sm">{stat.title}</CardTitle>
              <div className={cn('rounded-lg bg-muted p-2', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stat.value}</div>
              <p className="text-muted-foreground text-xs mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder for future content */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>Indicações e comissões das últimas 24 horas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Conteúdo em desenvolvimento...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}
