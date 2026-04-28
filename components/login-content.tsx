"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Lock, Building2, Users, Eye, EyeOff } from "lucide-react"

interface LoginContentProps {
  onLogin: (type: "admin" | "partner") => void
}

export function LoginContent({ onLogin }: LoginContentProps) {
  const [email, setEmail] = useState("admin@teste.com.vc")
  const [password, setPassword] = useState("123456")
  const [loginType, setLoginType] = useState<"admin" | "partner">("admin")
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleLoginTypeChange = (type: "admin" | "partner") => {
    setLoginType(type)
    if (type === "admin") {
      setEmail("admin@teste.com.vc")
    } else {
      setEmail("parceiro@teste.com.vc")
    }
    setPassword("123456")
    setError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Test credentials
    const credentials = {
      admin: { email: "admin@teste.com.vc", password: "123456" },
      partner: { email: "parceiro@teste.com.vc", password: "123456" },
    }

    const validCredentials = credentials[loginType]

    if (email === validCredentials.email && password === validCredentials.password) {
      onLogin(loginType)
    } else {
      setError("Email ou senha incorretos. Tente novamente.")
    }
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] p-8 text-center">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold bg-gradient-to-br from-[#FF7A28] to-[#0078B7] bg-clip-text text-transparent">
                P
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Partnership App</h2>
            <p className="text-white/90 text-sm">Acesse sua plataforma de parceiros</p>
          </div>

          {/* Login Form */}
          <div className="p-8">
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-900 mb-2">Credenciais de Teste:</p>
              <div className="space-y-1 text-xs text-blue-800">
                <p>
                  <strong>Admin:</strong> admin@teste.com.vc / 123456
                </p>
                <p>
                  <strong>Parceiro:</strong> parceiro@teste.com.vc / 123456
                </p>
              </div>
            </div>

            {/* Login Type Selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => handleLoginTypeChange("admin")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  loginType === "admin" ? "border-[#FF7A28] bg-[#FF7A28]/10" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Building2
                  className={`h-6 w-6 mx-auto mb-2 ${loginType === "admin" ? "text-[#FF7A28]" : "text-gray-400"}`}
                />
                <p className={`text-sm font-medium ${loginType === "admin" ? "text-[#FF7A28]" : "text-gray-600"}`}>
                  Admin
                </p>
              </button>
              <button
                onClick={() => handleLoginTypeChange("partner")}
                className={`p-4 rounded-xl border-2 transition-all ${
                  loginType === "partner" ? "border-[#0078B7] bg-[#0078B7]/10" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Users
                  className={`h-6 w-6 mx-auto mb-2 ${loginType === "partner" ? "text-[#0078B7]" : "text-gray-400"}`}
                />
                <p className={`text-sm font-medium ${loginType === "partner" ? "text-[#0078B7]" : "text-gray-600"}`}>
                  Parceiro
                </p>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#0A2E4D]">
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
                <Label htmlFor="password" className="text-[#0A2E4D]">
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
                className="w-full h-12 bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF8A38] hover:to-[#FFCE4B] text-white font-medium rounded-xl shadow-md"
              >
                Entrar como {loginType === "admin" ? "Admin" : "Parceiro"}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Esqueceu a senha? <button className="text-[#0078B7] hover:underline font-medium">Recuperar acesso</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
