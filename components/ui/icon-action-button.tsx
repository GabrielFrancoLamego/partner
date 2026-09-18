"use client"

import { Button, type buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { VariantProps } from "class-variance-authority"

/**
 * Botão de ícone com Tooltip real (hover, Radix) explicando a ação —
 * substitui o padrão anterior de `title="..."` (tooltip nativo do browser,
 * sem estilo e com delay inconsistente entre navegadores). Usar em toda
 * ação representada só por um ícone (editar, bloquear, arquivar, etc).
 */
export function IconActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "ghost",
  className,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: VariantProps<typeof buttonVariants>["variant"]
  className?: string
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn(className)}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
