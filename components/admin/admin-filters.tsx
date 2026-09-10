"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import type { AdminCompany } from "./use-companies"

/** Empresas já vêm ordenadas alfabeticamente por /api/admin/companies (orderBy: name asc). */
export function CompanyFilter({
  companies,
  value,
  onChange,
}: {
  companies: AdminCompany[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = companies.find((c) => c.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-64 justify-between bg-white font-normal"
        >
          <span className="truncate">{selected ? selected.name : "Todas as empresas"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar empresa..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Todas as empresas"
                onSelect={() => {
                  onChange("all")
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                Todas as empresas
              </CommandItem>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={company.name}
                  onSelect={() => {
                    onChange(company.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === company.id ? "opacity-100" : "opacity-0")} />
                  {company.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const PERIODS: { value: string; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "7 dias" },
  { value: "month", label: "30 dias" },
  { value: "year", label: "Ano" },
  { value: "all", label: "Tudo" },
]

export function PeriodFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 flex-wrap">
      {PERIODS.map((period) => (
        <Button
          key={period.value}
          size="sm"
          variant={value === period.value ? "default" : "ghost"}
          onClick={() => onChange(period.value)}
          className={
            value === period.value
              ? "text-xs bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
              : "text-xs text-gray-600 hover:bg-gray-50"
          }
        >
          {period.label}
        </Button>
      ))}
    </div>
  )
}
