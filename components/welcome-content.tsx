"use client"

import { ShieldCheck, Building2, Users, Sparkles } from "lucide-react"
import { LoginContent } from "./login-content"
import type { AuthUser } from "@/lib/role-bucket"

interface WelcomeContentProps {
  onLogin: (user: AuthUser) => void
}

const MISSION_POINTS = [
  {
    icon: ShieldCheck,
    title: "Controle centralizado",
    description: "Uma plataforma única para gerenciar licenças, empresas parceiras e trilha de auditoria completa.",
  },
  {
    icon: Building2,
    title: "Multi-empresa",
    description: "Cada empresa gerencia sua equipe, programas de indicação e comissões com processos padronizados.",
  },
  {
    icon: Users,
    title: "Parceiros engajados",
    description: "Parceiros e agências acompanham indicações, comissões e níveis de gamificação em tempo real.",
  },
]

export function WelcomeContent({ onLogin }: WelcomeContentProps) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left panel — brand story / mission (secondary on mobile, hero on desktop) */}
      <div className="relative bg-[#3E2415] text-white px-6 py-10 lg:w-1/2 lg:flex lg:flex-col lg:justify-center lg:px-16 lg:py-16 overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "linear-gradient(135deg, #F2680C, #FFC800)" }}
        />
        <div className="relative max-w-md mx-auto lg:mx-0">
          <img
            src="/brand/tribuss-simbolo-branco.png"
            alt="Tribuss"
            className="w-16 h-16 lg:w-20 lg:h-20 object-contain mb-6"
          />
          <h1 className="font-heading text-2xl lg:text-4xl font-bold mb-3 tracking-[-0.02em]">
            Gestão de parceiros, com processos e gamificação
          </h1>
          <p className="text-white/70 text-sm lg:text-base leading-relaxed mb-8 lg:mb-10">
            A Tribuss conecta administradores de plataforma, empresas e parceiros comerciais em um só lugar —
            do cadastro de licenças à comissão paga ao parceiro.
          </p>

          <div className="hidden lg:flex flex-col gap-6">
            {MISSION_POINTS.map((point) => {
              const Icon = point.icon
              return (
                <div key={point.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#FFC800]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{point.title}</p>
                    <p className="text-white/60 text-xs leading-relaxed">{point.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 mt-10 text-white/50 text-xs">
            <Sparkles className="w-4 h-4" />
            <span>Feito para times de turismo e hospitalidade</span>
          </div>
        </div>
      </div>

      {/* Right panel — access portals */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#E8F4F8] to-[#FFF5E6] px-4 py-8 sm:px-6 lg:w-1/2 lg:px-16">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6 lg:hidden">
            <h2 className="font-heading text-xl font-bold text-[#3E2415] mb-1">Bem-vindo à Tribuss</h2>
            <p className="text-sm text-gray-600">Escolha seu tipo de acesso para continuar.</p>
          </div>
          <div className="hidden lg:block mb-6">
            <h2 className="font-heading text-2xl font-bold text-[#3E2415] mb-1">Acessar a plataforma</h2>
            <p className="text-sm text-gray-600">Escolha seu tipo de acesso para continuar.</p>
          </div>

          <LoginContent onLogin={onLogin} />
        </div>
      </div>
    </div>
  )
}
