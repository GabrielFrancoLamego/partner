"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { AdminCompany } from "./use-companies"

export function CompanyFilter({
  companies,
  value,
  onChange,
}: {
  companies: AdminCompany[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56 bg-white">
        <SelectValue placeholder="Todas as empresas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as empresas</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
