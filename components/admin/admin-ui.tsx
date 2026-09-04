import type React from "react"
import { cn } from "@/lib/utils"

export function AdminCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title?: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("bg-white rounded-2xl p-5 shadow-md border border-gray-100", className)}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <div className="w-8 h-8 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
          <h3 className="text-base font-bold text-[#3E2415]">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}

export function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-bold text-[#3E2415]">{value}</span>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  AWAITING_VALUE: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  ANSWERED: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-green-100 text-green-700",
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Bloqueado",
  PENDING: "Pendente",
  PENDING_APPROVAL: "Pendente",
  AWAITING_VALUE: "Aguardando valor",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  PAID: "Pago",
  OPEN: "Aberto",
  IN_PROGRESS: "Em execução",
  ANSWERED: "Respondido",
  RESOLVED: "Concluído",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-center text-sm text-gray-500 py-10">{message}</p>
}

export function LoadingState() {
  return <p className="text-center text-sm text-gray-400 py-10">Carregando...</p>
}
