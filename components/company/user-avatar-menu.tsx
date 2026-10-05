"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ChevronDown, Eye, EyeOff, Lock, LogOut, UserCircle2, Wallet } from "lucide-react"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanyUser } from "@/lib/company-user-context"
import { LoadingState } from "@/components/admin/admin-ui"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { playEarningsSound } from "@/lib/earnings-sound"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U"
}

/**
 * Avatar do usuário no canto superior direito do Header (substitui o item
 * "Meu Perfil" que existia no menu lateral). Dropdown com Editar Meus Dados
 * (-> /company/perfil), Segurança (trocar senha via Supabase) e Preferências
 * de Notificação (canais + efeito sonoro de ganho financeiro).
 */
export function UserAvatarMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter()
  const user = useCompanyUser()
  const [securityOpen, setSecurityOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-[#F7F5F2] transition-colors">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white text-xs font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <p className="font-semibold text-[#3E2415] truncate">{name}</p>
            <p className="text-xs font-normal text-gray-400">{roleLabel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/company/perfil" className="cursor-pointer">
              <UserCircle2 className="h-4 w-4 mr-2" /> Editar Meus Dados
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="cursor-pointer">
            <Lock className="h-4 w-4 mr-2" /> Segurança (Alterar Senha)
          </DropdownMenuItem>
          {user.role === "EMPLOYEE" && (
            <DropdownMenuItem onClick={() => setWalletOpen(true)} className="cursor-pointer">
              <Wallet className="h-4 w-4 mr-2" /> Sua Carteira / Financeiro
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setPreferencesOpen(true)} className="cursor-pointer">
            <Bell className="h-4 w-4 mr-2" /> Preferências de Notificação
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {securityOpen && <SecurityDialog onClose={() => setSecurityOpen(false)} />}
      {preferencesOpen && <PreferencesDialog onClose={() => setPreferencesOpen(false)} />}
      {walletOpen && <WalletDialog onClose={() => setWalletOpen(false)} />}
    </>
  )
}

type WalletBucket = { paid: number; pending: number; nextDate: string | null }
type WalletSummary = {
  totals: { totalRecebidoPeriodo: number; totalAReceber: number; proximaDataPrevista: string | null }
  discounts: { consumoInterno: number; vales: number; descontosDiversos: number; impostos: number }
  earnings: {
    salarioFixo: WalletBucket
    taxaServico: WalletBucket
    metas: WalletBucket
    diarias: WalletBucket
    comprasDomingo: WalletBucket
    outrosAdicionais: WalletBucket
  }
}
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const EARNINGS_LABELS: Record<keyof WalletSummary["earnings"], string> = {
  salarioFixo: "Salário Fixo",
  taxaServico: "Taxa de Serviço",
  metas: "Metas",
  diarias: "Diárias",
  comprasDomingo: "Compras de Domingo",
  outrosAdicionais: "Outros Adicionais",
}

/** "Sua Carteira / Financeiro" — extrato simplificado no formato carteira de banco, exclusivo do colaborador (ver /api/company/my-account, sem dados de parceiros). */
function WalletDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WalletSummary | null>(null)
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    adminFetch<WalletSummary>("/api/company/my-account").then(setData)
  }, [])

  const saldoAcumulado = data
    ? data.totals.totalRecebidoPeriodo -
      (data.discounts.consumoInterno + data.discounts.vales + data.discounts.descontosDiversos + data.discounts.impostos)
    : 0

  const earningsRows = data ? (Object.entries(data.earnings) as [keyof WalletSummary["earnings"], WalletBucket][]).filter(([, b]) => b.paid > 0 || b.pending > 0) : []
  const discountRows = data
    ? ([
        ["Conta de Consumo Interno", data.discounts.consumoInterno],
        ["Vales/Adiantamentos", data.discounts.vales],
        ["Descontos Diversos", data.discounts.descontosDiversos],
        ["Impostos", data.discounts.impostos],
      ] as [string, number][]).filter(([, v]) => v > 0)
    : []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sua Carteira</DialogTitle>
        </DialogHeader>
        {!data ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-2xl p-5 text-white">
              <p className="text-xs opacity-90">Saldo Acumulado (recebido no período)</p>
              <p className="text-3xl font-bold">{currency(saldoAcumulado)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Ganhos Passados</p>
                <p className="text-lg font-bold text-green-600">{currency(data.totals.totalRecebidoPeriodo)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Recebimentos Futuros</p>
                <p className="text-lg font-bold text-amber-600">{currency(data.totals.totalAReceber)}</p>
                {data.totals.proximaDataPrevista && (
                  <p className="text-[11px] text-gray-400">Previsto: {new Date(data.totals.proximaDataPrevista).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
            </div>

            {!showFull ? (
              <button type="button" onClick={() => setShowFull(true)} className="block w-full text-xs text-center text-[#F58220] underline">
                Ver extrato completo →
              </button>
            ) : (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-[#3E2415] mb-1.5">Ganhos / Entradas</p>
                  {earningsRows.length === 0 ? (
                    <p className="text-xs text-gray-400">Nenhum lançamento de ganhos neste período.</p>
                  ) : (
                    <div className="space-y-1">
                      {earningsRows.map(([key, b]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{EARNINGS_LABELS[key]}</span>
                          <span className="text-right">
                            {b.paid > 0 && <span className="text-green-600 font-medium">{currency(b.paid)} pago</span>}
                            {b.paid > 0 && b.pending > 0 && " · "}
                            {b.pending > 0 && <span className="text-amber-600 font-medium">{currency(b.pending)} pendente</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {discountRows.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#3E2415] mb-1.5">Descontos / Saídas</p>
                    <div className="space-y-1">
                      {discountRows.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{label}</span>
                          <span className="text-red-600 font-medium">-{currency(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecurityDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setSuccess(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segurança — Alterar Senha</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">Senha atualizada com sucesso.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                {isSubmitting ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

type Preferences = { notifyViaPush: boolean; notifyViaEmail: boolean; notifyViaWhatsapp: boolean; soundOnEarnings: boolean }

function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetch("/api/account/notification-preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPrefs(data))
  }, [])

  const update = async (patch: Partial<Preferences>) => {
    if (!prefs) return
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setIsSaving(true)
    try {
      await fetch("/api/account/notification-preferences", { method: "PATCH", body: JSON.stringify(patch) })
      if (patch.soundOnEarnings) playEarningsSound()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preferências de Notificação</DialogTitle>
        </DialogHeader>
        {!prefs ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Escolha onde deseja receber avisos da plataforma.</p>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Notificação Push no App</Label>
              <Switch checked={prefs.notifyViaPush} onCheckedChange={(v) => update({ notifyViaPush: v })} disabled={isSaving} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">E-mail</Label>
              <Switch checked={prefs.notifyViaEmail} onCheckedChange={(v) => update({ notifyViaEmail: v })} disabled={isSaving} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">WhatsApp</Label>
              <Switch checked={prefs.notifyViaWhatsapp} onCheckedChange={(v) => update({ notifyViaWhatsapp: v })} disabled={isSaving} />
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div>
                <Label className="font-normal">Som ao receber bônus/comissão</Label>
                <p className="text-[11px] text-gray-400">Efeito sonoro ao ganhar um bônus ou comissão no app.</p>
              </div>
              <Switch checked={prefs.soundOnEarnings} onCheckedChange={(v) => update({ soundOnEarnings: v })} disabled={isSaving} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={onClose} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
