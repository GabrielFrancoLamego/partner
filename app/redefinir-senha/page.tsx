"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // O link de recuperação do Supabase estabelece a sessão automaticamente
    // ao carregar a página (detectSessionInUrl, padrão do client de browser)
    // — só liberamos o formulário depois de confirmar que a sessão existe.
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setIsReady(Boolean(data.session)))
  }, [])

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
      setTimeout(() => router.push("/"), 2000)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
        <h1 className="text-lg font-bold text-[#3E2415] mb-1">Redefinir senha</h1>
        <p className="text-sm text-gray-500 mb-6">Escolha uma nova senha de acesso à Tribuss.</p>

        {success ? (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
            Senha atualizada! Redirecionando para o login...
          </p>
        ) : !isReady ? (
          <p className="text-sm text-gray-500">
            Link inválido ou expirado. Solicite um novo link de redefinição na tela de login.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-xl"
                required
              />
            </div>
            <Button type="submit" variant="brand" disabled={isSubmitting} className="w-full h-12 rounded-xl">
              {isSubmitting ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
