"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { User, Lock, ShieldCheck, Building2, Users, Eye, EyeOff, Check, Zap, UserPlus } from "lucide-react"
import type { AuthUser } from "@/lib/role-bucket"
import { createClient } from "@/lib/supabase/client"

const DEMO_PASSWORD = "123456"

/**
 * Login com Google fica oculto até o provedor ser configurado (Google Cloud +
 * Supabase). Para religar: NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true na Vercel e
 * um novo deploy.
 */
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true"

/**
 * Contas semeadas no ambiente local de testes (prisma/seed-*.ts), todas com
 * senha "123456". Lista mantida à mão — só as contas @teste.com.vc / a
 * parceira de teste, nunca os ~170 parceiros reais importados da planilha.
 */
type DemoAccount = { email: string; name: string; portal: Portal }
const DEMO_ACCOUNTS: { group: string; accounts: DemoAccount[] }[] = [
  {
    group: "Plataforma",
    accounts: [{ email: "admin@teste.com.vc", name: "Admin Plataforma", portal: "platform" }],
  },
  {
    group: "Master",
    accounts: [
      { email: "master@teste.com.vc", name: "Master — Nomad's Jeri", portal: "company" },
      { email: "master.lagoa@teste.com.vc", name: "Master — Nomad's Lagoa", portal: "company" },
      { email: "master.inon@teste.com.vc", name: "Master — IN-ON", portal: "company" },
    ],
  },
  {
    group: "Gerente",
    accounts: [
      { email: "gerente@teste.com.vc", name: "Gerente — Nomad's Jeri", portal: "company" },
      { email: "gerente.lagoa@teste.com.vc", name: "Gerente — Nomad's Lagoa", portal: "company" },
      { email: "gerente.inon@teste.com.vc", name: "Gerente — IN-ON", portal: "company" },
    ],
  },
  {
    group: "Financeiro",
    accounts: [
      { email: "financeiro@teste.com.vc", name: "Financeiro — Nomad's Jeri", portal: "company" },
      { email: "financeiro.lagoa@teste.com.vc", name: "Financeiro — Nomad's Lagoa", portal: "company" },
      { email: "financeiro.inon@teste.com.vc", name: "Financeiro — IN-ON", portal: "company" },
    ],
  },
  {
    group: "Colaborador / Operador",
    accounts: [
      { email: "colaborador@teste.com.vc", name: "Colaborador Teste — Nomad's Jeri", portal: "company" },
      { email: "ana.jeri@teste.com.vc", name: "Ana Beatriz Souza — Nomad's Jeri", portal: "company" },
      { email: "rafael.jeri@teste.com.vc", name: "Rafael Torres — Nomad's Jeri", portal: "company" },
      { email: "colaborador.lagoa@teste.com.vc", name: "Colaborador Teste — Nomad's Lagoa", portal: "company" },
      { email: "lucas.lagoa@teste.com.vc", name: "Lucas Prado — Nomad's Lagoa", portal: "company" },
      { email: "marina.lagoa@teste.com.vc", name: "Marina Duarte — Nomad's Lagoa", portal: "company" },
      { email: "colaborador.inon@teste.com.vc", name: "Colaborador Teste — IN-ON", portal: "company" },
      { email: "camila.inon@teste.com.vc", name: "Camila Rocha — IN-ON", portal: "company" },
      { email: "thiago.inon@teste.com.vc", name: "Thiago Nunes — IN-ON", portal: "company" },
    ],
  },
  {
    group: "Parceiro",
    accounts: [{ email: "parceiro@teste.com.vc", name: "Parceiro Teste", portal: "partner" }],
  },
]

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_profile: "Sua conta Google não está vinculada a nenhum perfil na plataforma. Peça a um administrador para cadastrar seu email primeiro.",
  inactive: "Sua conta está inativa. Fale com um administrador.",
  exchange_failed: "Não foi possível confirmar o login com o Google. Tente novamente.",
  missing_code: "Login com Google cancelado ou inválido.",
}

interface LoginContentProps {
  onLogin: (user: AuthUser) => void
}

type Portal = "platform" | "company" | "partner"

const PORTALS: Record<
  Portal,
  { label: string; description: string; icon: typeof ShieldCheck; accent: string; demoEmail: string }
> = {
  platform: {
    label: "Administrador da Plataforma",
    description: "Acesso global para gestão de licenças, empresas e auditoria.",
    icon: ShieldCheck,
    accent: "#3E2415",
    demoEmail: "admin@teste.com.vc",
  },
  company: {
    label: "Empresas",
    description: "Master, Gerente, Financeiro e Operador/Scanner da empresa.",
    icon: Building2,
    accent: "#F58220",
    demoEmail: "master@teste.com.vc",
  },
  partner: {
    label: "Parceiros & Agências",
    description: "Pessoa física ou agência de turismo que indica clientes.",
    icon: Users,
    accent: "#15803D",
    demoEmail: "parceiro@teste.com.vc",
  },
}

export function LoginContent({ onLogin }: LoginContentProps) {
  const searchParams = useSearchParams()
  const [portal, setPortal] = useState<Portal>("platform")
  const [email, setEmail] = useState(PORTALS.platform.demoEmail)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const authError = searchParams.get("authError")
    if (authError) {
      setError(AUTH_ERROR_MESSAGES[authError] ?? "Não foi possível entrar. Tente novamente.")
    }
  }, [searchParams])

  const handlePortalChange = (next: Portal) => {
    setPortal(next)
    setEmail(PORTALS[next].demoEmail)
    setPassword(DEMO_PASSWORD)
    setError("")
  }

  const handleDemoAccountChange = (nextEmail: string) => {
    const account = DEMO_ACCOUNTS.flatMap((g) => g.accounts).find((a) => a.email === nextEmail)
    if (!account) return
    setPortal(account.portal)
    setEmail(account.email)
    setPassword(DEMO_PASSWORD)
    setError("")
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setIsGoogleLoading(false)
    }
    // Sucesso redireciona a página inteira para o Google — nada mais a fazer aqui.
  }

  const handleOpenForgotPassword = () => {
    setForgotPasswordEmail(email)
    setResetSent(false)
    setIsForgotPasswordOpen(true)
  }

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSendingReset(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      })
    } finally {
      setResetSent(true)
      setIsSendingReset(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Email ou senha incorretos. Tente novamente.")
        return
      }

      onLogin(data as AuthUser)
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-8">
          {/* Portal Selector */}
          <div className="space-y-2 mb-6">
            {(Object.entries(PORTALS) as [Portal, (typeof PORTALS)["platform"]][]).map(([key, info]) => {
              const Icon = info.icon
              const isActive = portal === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePortalChange(key)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                  style={{
                    borderColor: isActive ? info.accent : "#E5E7EB",
                    backgroundColor: isActive ? `${info.accent}14` : "transparent",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isActive ? info.accent : "#F3F4F6" }}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isActive ? info.accent : "#3E2415" }}>
                      {info.label}
                    </p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">{info.description}</p>
                  </div>
                  {isActive && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: info.accent }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <Link
            href="/join/partner"
            className="flex items-center justify-center gap-2 w-full h-11 mb-4 rounded-xl border-2 border-dashed border-[#15803D]/40 text-[#15803D] font-medium text-sm hover:bg-[#15803D]/5 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar como Parceiro / Indicador
          </Link>

          <p className="text-xs text-gray-400 mb-3 text-center">
            Ambiente local de testes — senha para todas as contas: <strong className="text-gray-600">{DEMO_PASSWORD}</strong>
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="space-y-1.5 mb-6">
              <Label htmlFor="demo-account" className="text-[#3E2415] flex items-center gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" style={{ color: "#F58220" }} />
                Acesso rápido (teste)
              </Label>
              <Select value={email} onValueChange={handleDemoAccountChange}>
                <SelectTrigger id="demo-account" className="w-full h-11 rounded-xl">
                  <SelectValue placeholder="Selecione uma conta de teste..." />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_ACCOUNTS.map(({ group, accounts }) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{group}</SelectLabel>
                      {accounts.map((account) => (
                        <SelectItem key={account.email} value={account.email}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#3E2415]">
                Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#3E2415]">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF8A38] hover:to-[#FFCE4B] text-white font-medium rounded-xl shadow-md disabled:opacity-70"
            >
              {isSubmitting ? "Entrando..." : `Entrar em ${PORTALS[portal].label}`}
            </Button>
          </form>

          {GOOGLE_LOGIN_ENABLED && (
          <>
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full h-12 rounded-xl border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-70"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.28-2.1 3.56-5.19 3.56-8.84Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.27v3.11C3.25 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.27A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.11Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.11c.95-2.83 3.6-4.94 6.72-4.94Z"
              />
            </svg>
            {isGoogleLoading ? "Redirecionando..." : "Continuar com o Google"}
          </Button>
          </>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Esqueceu a senha?{" "}
            <button type="button" onClick={handleOpenForgotPassword} className="text-[#3E2415] hover:underline font-medium">
              Recuperar acesso
            </button>
          </p>
        </div>
      </div>

      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar acesso</DialogTitle>
          </DialogHeader>
          {resetSent ? (
            <p className="text-sm text-gray-600">
              Se houver uma conta com este email, enviamos um link de redefinição de senha. Confira sua caixa de
              entrada (e o spam).
            </p>
          ) : (
            <form onSubmit={handleSendResetLink} className="space-y-4">
              <p className="text-sm text-gray-600">Informe seu email de acesso para receber o link de redefinição de senha.</p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" variant="brand" disabled={isSendingReset}>
                  {isSendingReset ? "Enviando..." : "Enviar link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
