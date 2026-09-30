"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, Eye, EyeOff, Lock, LogOut, ShieldCheck, UserCircle2, Camera, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U"
}

/**
 * Avatar do Parceiro no canto superior direito do Header — substitui o item
 * "Meu Perfil" que existia no menu lateral. Dropdown com Completar Dados
 * Cadastrais (-> /partner/perfil), Upload de Foto, Alterar Senha e 2FA.
 */
export function PartnerAvatarMenu({ name, photoUrl, onPhotoUpdated }: { name: string; photoUrl: string | null; onPhotoUpdated: (url: string) => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/")
    router.refresh()
  }

  const handlePhotoSelected = async (file: File | undefined) => {
    if (!file) return
    setIsUploadingPhoto(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const { url } = await adminFetch<{ url: string }>("/api/partner/uploads", { method: "POST", body })
      await adminFetch("/api/partner/profile", { method: "PATCH", body: JSON.stringify({ photoUrl: url }) })
      onPhotoUpdated(url)
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao enviar foto")
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-[#F7F5F2] transition-colors">
            <Avatar className="h-8 w-8">
              {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
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
            <p className="text-xs font-normal text-gray-400">Parceiro Tribuss</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/partner/perfil" className="cursor-pointer">
              <UserCircle2 className="h-4 w-4 mr-2" /> Completar Dados Cadastrais
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              fileInputRef.current?.click()
            }}
            disabled={isUploadingPhoto}
            className="cursor-pointer"
          >
            {isUploadingPhoto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            {isUploadingPhoto ? "Enviando..." : "Foto de Perfil"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="cursor-pointer">
            <Lock className="h-4 w-4 mr-2" /> Alterar Senha
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTwoFactorOpen(true)} className="cursor-pointer">
            <ShieldCheck className="h-4 w-4 mr-2" /> Autenticação em Duas Etapas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
      />

      {securityOpen && <SecurityDialog onClose={() => setSecurityOpen(false)} />}
      {twoFactorOpen && <TwoFactorDialog onClose={() => setTwoFactorOpen(false)} />}
    </>
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

type SetupData = { secret: string; qrDataUrl: string }

function TwoFactorDialog({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/account/2fa")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEnabled(Boolean(data?.enabled)))
  }, [])

  const startSetup = async () => {
    setError("")
    const data = await adminFetch<SetupData>("/api/account/2fa", { method: "POST" }).catch((e) => {
      setError(e instanceof AdminApiError ? e.message : "Erro ao iniciar setup")
      return null
    })
    if (data) setSetupData(data)
  }

  const confirmEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/account/2fa", { method: "PATCH", body: JSON.stringify({ code, action: "enable" }) })
      setEnabled(true)
      setSetupData(null)
      setCode("")
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Código inválido")
    } finally {
      setIsSubmitting(false)
    }
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      await adminFetch("/api/account/2fa", { method: "PATCH", body: JSON.stringify({ code, action: "disable" }) })
      setEnabled(false)
      setCode("")
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Código inválido")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Autenticação em Duas Etapas (2FA)</DialogTitle>
        </DialogHeader>

        {enabled === null ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : enabled ? (
          <form onSubmit={disable} className="space-y-4">
            <p className="text-sm text-gray-600">O 2FA está ativo na sua conta. Digite um código atual do app autenticador para desativar.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button type="submit" disabled={isSubmitting || code.length !== 6} className="bg-red-600 hover:bg-red-700 text-white">
                Desativar 2FA
              </Button>
            </DialogFooter>
          </form>
        ) : setupData ? (
          <form onSubmit={confirmEnable} className="space-y-4">
            <p className="text-sm text-gray-600">Escaneie o QR Code com Google Authenticator, Authy ou similar e digite o código de 6 dígitos gerado.</p>
            <img src={setupData.qrDataUrl} alt="QR Code 2FA" className="w-48 h-48 mx-auto rounded-xl border border-gray-100" />
            <p className="text-[11px] text-gray-400 text-center break-all">Ou digite manualmente: {setupData.secret}</p>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || code.length !== 6} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                Confirmar e Ativar
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Proteja sua conta com um segundo código, gerado por um app autenticador, além da sua senha.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button type="button" onClick={startSetup} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                Ativar 2FA
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
