import type React from "react"

/**
 * Padrão responsivo para listas com ações (editar/bloquear/excluir...):
 * tabela com scroll horizontal no desktop, cards empilhados com os botões
 * sempre visíveis abaixo no mobile — evita depender de arrastar a tabela
 * para o lado para alcançar as ações, que é pouco descobrível no toque.
 *
 * Uso: envolva o <table> existente em <TableDesktop>, e monte um
 * <MobileCard> por linha dentro de <MobileCardList>, lado a lado.
 */
export function TableDesktop({ children }: { children: React.ReactNode }) {
  return <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100">{children}</div>
}

export function MobileCardList({ children }: { children: React.ReactNode }) {
  return <div className="md:hidden space-y-3">{children}</div>
}

export function MobileCard({
  title,
  subtitle,
  badges,
  fields,
  actions,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badges?: React.ReactNode
  fields?: { label: string; value: React.ReactNode }[]
  actions?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[#3E2415] truncate">{title}</p>
          {subtitle && <div className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</div>}
        </div>
        {badges && <div className="flex-shrink-0 flex items-center gap-1">{badges}</div>}
      </div>

      {fields && fields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-3">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-gray-400">{field.label}</dt>
              <dd className="text-gray-700 font-medium truncate">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {actions && <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">{actions}</div>}
    </div>
  )
}

/** Botão de ação para dentro de um MobileCard — sempre com rótulo visível (sem depender de title/hover). */
export function MobileCardAction({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  tone?: "default" | "danger"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
        tone === "danger"
          ? "border-red-200 text-red-600 bg-red-50 active:bg-red-100"
          : "border-gray-200 text-gray-700 bg-gray-50 active:bg-gray-100"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
