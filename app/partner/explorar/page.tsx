"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, X, MapPin, FileText, Youtube, History, LogOut as LeaveIcon, Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState, EmptyState, StatusBadge } from "@/components/admin/admin-ui"
import { StarRatingDisplay } from "@/components/partner/star-rating"
import { AdesaoGateDialog } from "@/components/partner/adesao-gate-dialog"

type MembershipStatus = "ACTIVE" | "LEFT_BY_PARTNER" | "TERMINATED_INACTIVITY" | "PROGRAM_ENDED"

type ProgramListing = {
  programId: string
  companyId: string
  name: string
  description: string
  imageUrl: string | null
  pdfUrl: string | null
  videoUrl: string | null
  commissionType: "FIXED" | "VARIABLE" | "BOTH"
  commissionValue: string
  commissionFormat: "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"
  fixedValue: string | null
  productUnitLabel: string | null
  status: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED"
  pauseEffectiveAt: string | null
  company: {
    id: string
    name: string
    city: string | null
    segment: string | null
    avgRating: string | null
    ratingCount: number
    profilePictureUrl: string | null
  }
  membership: { status: MembershipStatus; lastChangeAckAt: string | null; forfeitedBalance: string | null } | null
}

function commissionSummary(p: ProgramListing) {
  const base =
    p.commissionFormat === "PERCENTAGE"
      ? `${p.commissionValue}%`
      : p.commissionFormat === "FIXED_VALUE"
        ? `R$ ${p.commissionValue}`
        : `${p.commissionValue}x ${p.productUnitLabel ?? "unidade"}`
  return p.commissionType === "BOTH" && p.fixedValue ? `${base} + R$ ${p.fixedValue}` : base
}

const MEMBERSHIP_LABELS: Record<MembershipStatus, string> = {
  ACTIVE: "Você participa",
  LEFT_BY_PARTNER: "Você saiu",
  TERMINATED_INACTIVITY: "Desligado por inatividade",
  PROGRAM_ENDED: "Programa encerrado",
}

export default function PartnerExplorarPage() {
  const [programs, setPrograms] = useState<ProgramListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [minCommission, setMinCommission] = useState("")
  const [minRating, setMinRating] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProgramListing | null>(null)
  const [leaving, setLeaving] = useState<ProgramListing | null>(null)
  const [adesaoGateFor, setAdesaoGateFor] = useState<ProgramListing | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<ProgramListing[]>("/api/partner/explorar")
      .then(setPrograms)
      .finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const cities = useMemo(
    () => Array.from(new Set(programs.map((p) => p.company.city).filter((c): c is string => Boolean(c)))).sort(),
    [programs],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return programs.filter((p) => {
      if (q) {
        const haystack = `${p.company.name} ${p.company.segment ?? ""} ${p.name}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (cityFilter && p.company.city !== cityFilter) return false
      if (minCommission) {
        const min = Number(minCommission)
        const value = Number(p.commissionValue) + (p.fixedValue ? Number(p.fixedValue) : 0)
        if (value < min) return false
      }
      if (minRating) {
        const min = Number(minRating)
        if (!p.company.avgRating || Number(p.company.avgRating) < min) return false
      }
      return true
    })
  }, [programs, query, cityFilter, minCommission, minRating])

  const hasFilter = Boolean(query || cityFilter || minCommission || minRating)
  const clearFilters = () => {
    setQuery("")
    setCityFilter(null)
    setMinCommission("")
    setMinRating(null)
  }

  const handleJoin = async (program: ProgramListing) => {
    try {
      await adminFetch(`/api/partner/programs/${program.programId}/join`, { method: "POST" })
      reload()
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 428) {
        setAdesaoGateFor(program)
        return
      }
      alert(e instanceof AdminApiError ? e.message : "Erro ao participar")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Explorar Programas</h1>
          <p className="text-gray-600 mt-1 text-sm">Encontre empresas parceiras e participe do programa de comissão delas.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <Link href="/partner/mapa">
            <Map className="h-4 w-4 mr-1.5" /> Ver no Mapa
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por empresa, categoria ou palavra-chave..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={cityFilter ?? "all"} onValueChange={(v) => setCityFilter(v === "all" ? null : v)}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
              <SelectValue placeholder="Região/Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            value={minCommission}
            onChange={(e) => setMinCommission(e.target.value)}
            placeholder="Comissão mín. (R$/%)"
            className="w-full sm:w-44 h-9 text-xs"
          />
          <Select value={minRating ?? "all"} onValueChange={(v) => setMinRating(v === "all" ? null : v)}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
              <SelectValue placeholder="Avaliação mínima" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer avaliação</SelectItem>
              {[5, 4, 3, 2, 1].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}+ estrelas
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
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState message={hasFilter ? "Nenhum programa nesses filtros." : "Nenhum programa externo cadastrado ainda."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.programId} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm flex flex-col">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-[#F2680C]/10 to-[#FFC800]/10" />
              )}
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#3E2415] truncate">{p.company.name}</p>
                  {p.status !== "ACTIVE" && <StatusBadge status={p.status} />}
                </div>
                {p.company.city && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {p.company.city}
                    {p.company.segment && ` · ${p.company.segment}`}
                  </p>
                )}
                <StarRatingDisplay value={p.company.avgRating} count={p.company.ratingCount} />
                <p className="text-sm text-orange-700 font-bold">{commissionSummary(p)}</p>
                {p.status === "PAUSED_FOR_NEW_MEMBERS" && p.pauseEffectiveAt && (
                  <p className="text-[11px] text-amber-700">
                    Fecha em {new Date(p.pauseEffectiveAt).toLocaleDateString("pt-BR")} — quem já participa mantém acesso total.
                  </p>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDetail(p)}
                    className="text-xs font-medium text-[#3E2415] underline underline-offset-2 flex items-center gap-1"
                  >
                    <History className="h-3.5 w-3.5" /> Detalhes/Histórico
                  </button>
                </div>

                {p.membership?.status === "ACTIVE" ? (
                  <Button size="sm" variant="outline" className="w-full text-red-600 hover:text-red-700" onClick={() => setLeaving(p)}>
                    <LeaveIcon className="h-4 w-4 mr-1.5" /> Sair do Programa
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="brand"
                    className="w-full"
                    disabled={p.status !== "ACTIVE"}
                    onClick={() => handleJoin(p)}
                  >
                    {p.status !== "ACTIVE" ? "Fechado p/ novas adesões" : p.membership ? "Participar novamente" : "Participar"}
                  </Button>
                )}
                {p.membership && p.membership.status !== "ACTIVE" && (
                  <p className="text-[11px] text-gray-500 text-center">{MEMBERSHIP_LABELS[p.membership.status]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && <ProgramDetailDialog program={detail} onClose={() => setDetail(null)} onChanged={reload} />}
      {leaving && (
        <LeaveConfirmDialog
          program={leaving}
          onClose={() => setLeaving(null)}
          onConfirmed={() => {
            setLeaving(null)
            reload()
          }}
        />
      )}
      {adesaoGateFor && (
        <AdesaoGateDialog
          onClose={() => setAdesaoGateFor(null)}
          onCompleted={() => {
            const program = adesaoGateFor
            setAdesaoGateFor(null)
            handleJoin(program)
          }}
        />
      )}
    </div>
  )
}

function ProgramDetailDialog({ program, onClose, onChanged }: { program: ProgramListing; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{
    description: string
    videoUrl: string | null
    pdfUrl: string | null
    changeLog: { id: string; summary: string; createdAt: string; changedBy: { name: string } }[]
    membership: { lastChangeAckAt: string | null } | null
  } | null>(null)
  const [isAcking, setIsAcking] = useState(false)

  useEffect(() => {
    adminFetch<typeof data>(`/api/partner/programs/${program.programId}`).then(setData)
  }, [program.programId])

  const handleAck = async () => {
    setIsAcking(true)
    try {
      await adminFetch(`/api/partner/programs/${program.programId}/ack-change`, { method: "POST" })
      onChanged()
      onClose()
    } finally {
      setIsAcking(false)
    }
  }

  const pendingAck = Boolean(program.membership?.status === "ACTIVE" && !data?.membership?.lastChangeAckAt && data?.changeLog?.length)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{program.company.name} — {program.name}</DialogTitle>
        </DialogHeader>
        {!data ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.description}</p>
            <div className="flex items-center gap-3 flex-wrap">
              {data.pdfUrl && (
                <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] flex items-center gap-1 underline">
                  <FileText className="h-3.5 w-3.5" /> Regulamento (PDF)
                </a>
              )}
              {data.videoUrl && (
                <a href={data.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F58220] flex items-center gap-1 underline">
                  <Youtube className="h-3.5 w-3.5" /> Vídeo institucional
                </a>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h4 className="font-semibold text-[#3E2415] text-sm mb-2">Histórico de mudanças</h4>
              {data.changeLog.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhuma mudança de regras registrada ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {data.changeLog.map((c) => (
                    <li key={c.id} className="text-xs text-gray-600 border-l-2 border-amber-300 pl-2">
                      <p className="text-gray-400">{new Date(c.createdAt).toLocaleString("pt-BR")} · {c.changedBy.name}</p>
                      <p>{c.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pendingAck && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                <p className="text-xs text-amber-800">As regras deste programa mudaram. Confirme que está ciente para continuar participando.</p>
                <Button size="sm" variant="brand" disabled={isAcking} onClick={handleAck}>
                  Confirmar Aceite
                </Button>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveConfirmDialog({
  program,
  onClose,
  onConfirmed,
}: {
  program: ProgramListing
  onClose: () => void
  onConfirmed: () => void
}) {
  const [pendingBalance, setPendingBalance] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    adminFetch<{ pendingBalance: number }>(`/api/partner/programs/${program.programId}/leave`).then((r) => setPendingBalance(r.pendingBalance))
  }, [program.programId])

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await adminFetch(`/api/partner/programs/${program.programId}/leave`, { method: "POST" })
      onConfirmed()
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao sair do programa")
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sair de "{program.name}"?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Você deixará de indicar clientes e gerar QR Codes para {program.company.name}.</p>
          {pendingBalance === null ? (
            <LoadingState />
          ) : pendingBalance > 0 ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-700">
                Saldo pendente: R$ {pendingBalance.toFixed(2)}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Esse valor ainda não foi sacado e será PERDIDO/cancelado ao confirmar a saída. Se quiser, saque antes de sair.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Você não tem saldo pendente nesta empresa.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="brand" className="bg-red-600 hover:brightness-90" disabled={isConfirming || pendingBalance === null} onClick={handleConfirm}>
            Confirmar Saída
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
