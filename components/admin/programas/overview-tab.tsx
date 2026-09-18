"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { ProgramTypeBadge } from "@/components/shared/program-type-badge"

type PartnerProgram = {
  id: string
  name: string
  active: boolean
  commissionType: "FIXED" | "VARIABLE" | "BOTH"
  commissionValue: string
  fixedValue: string | null
  company: { id: string; name: string; city: string | null }
}
type InternalProgram = {
  id: string
  title: string
  active: boolean
  basePoints: number
  company: { id: string; name: string; city: string | null }
}

type UnifiedRow = {
  key: string
  type: "PARTNER" | "INTERNAL"
  title: string
  companyId: string
  companyName: string
  city: string | null
  active: boolean
  commissionKind: "PERCENTAGE" | "FIXED" | "BOTH" | "XP"
  commissionSummary: string
}

const COMMISSION_FILTER_LABELS: Record<string, string> = {
  all: "Todos",
  PERCENTAGE: "Porcentagem (%)",
  FIXED: "Valor Fixo (R$)",
  BOTH: "Ambas (% + R$)",
  XP: "Pontuação/XP",
}

function commissionKindOf(p: PartnerProgram): "PERCENTAGE" | "FIXED" | "BOTH" {
  if (p.commissionType === "BOTH") return "BOTH"
  return p.commissionType === "FIXED" ? "FIXED" : "PERCENTAGE"
}

function commissionSummaryOf(p: PartnerProgram): string {
  if (p.commissionType === "BOTH") return `${p.commissionValue}% + R$ ${p.fixedValue ?? "0"}`
  if (p.commissionType === "FIXED") return `R$ ${p.commissionValue} fixo`
  return `${p.commissionValue}%`
}

export function OverviewTab({
  onManage,
}: {
  onManage: (target: { type: "PARTNER" | "INTERNAL"; companyId: string }) => void
}) {
  const { companies } = useCompanies()
  const [partnerPrograms, setPartnerPrograms] = useState<PartnerProgram[]>([])
  const [internalPrograms, setInternalPrograms] = useState<InternalProgram[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<"all" | "INTERNAL" | "PARTNER">("all")
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [commissionFilter, setCommissionFilter] = useState<string>("all")

  useEffect(() => {
    setIsLoading(true)
    Promise.all([
      adminFetch<PartnerProgram[]>("/api/admin/programs"),
      adminFetch<InternalProgram[]>("/api/admin/internal-programs"),
    ])
      .then(([partner, internal]) => {
        setPartnerPrograms(partner)
        setInternalPrograms(internal)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const cities = useMemo(
    () => Array.from(new Set(companies.map((c) => c.city).filter((c): c is string => Boolean(c)))).sort(),
    [companies],
  )

  const rows: UnifiedRow[] = useMemo(() => {
    const fromPartner = partnerPrograms.map((p): UnifiedRow => ({
      key: `partner-${p.id}`,
      type: "PARTNER",
      title: p.name,
      companyId: p.company.id,
      companyName: p.company.name,
      city: p.company.city,
      active: p.active,
      commissionKind: commissionKindOf(p),
      commissionSummary: commissionSummaryOf(p),
    }))
    const fromInternal = internalPrograms.map((p): UnifiedRow => ({
      key: `internal-${p.id}`,
      type: "INTERNAL",
      title: p.title,
      companyId: p.company.id,
      companyName: p.company.name,
      city: p.company.city,
      active: p.active,
      commissionKind: "XP",
      commissionSummary: `${p.basePoints} pts base/mês`,
    }))
    return [...fromPartner, ...fromInternal]
  }, [partnerPrograms, internalPrograms])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false
      if (cityFilter && r.city !== cityFilter) return false
      if (companyFilter && r.companyId !== companyFilter) return false
      if (commissionFilter !== "all" && r.commissionKind !== commissionFilter) return false
      return true
    })
  }, [rows, typeFilter, cityFilter, companyFilter, commissionFilter])

  const hasFilter = typeFilter !== "all" || Boolean(cityFilter) || Boolean(companyFilter) || commissionFilter !== "all"
  const clearFilters = () => {
    setTypeFilter("all")
    setCityFilter(null)
    setCompanyFilter(null)
    setCommissionFilter("all")
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="INTERNAL">Interno (Colaboradores)</SelectItem>
            <SelectItem value="PARTNER">Externo (Parceiros)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={cityFilter ?? "all"} onValueChange={(v) => setCityFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Cidades</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={companyFilter ?? "all"} onValueChange={(v) => setCompanyFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={commissionFilter} onValueChange={setCommissionFilter}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
            <SelectValue placeholder="Comissão/Premiação" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMMISSION_FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-0.5 text-xs font-medium text-orange-800 underline underline-offset-2 cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState message={hasFilter ? "Nenhum programa nesses filtros." : "Nenhum programa cadastrado ainda."} />
      ) : (
        <div className="grid gap-2">
          {filteredRows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <ProgramTypeBadge type={row.type} />
                  <StatusBadge status={row.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <p className="font-semibold text-[#3E2415]">{row.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {row.companyName}
                  {row.city && ` · ${row.city}`} · {row.commissionSummary}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0 self-start sm:self-auto"
                onClick={() => onManage({ type: row.type, companyId: row.companyId })}
              >
                <Settings className="h-4 w-4 mr-1" />
                Gerenciar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
