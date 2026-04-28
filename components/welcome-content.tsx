"use client"

import { Compass } from "lucide-react"

export function WelcomeContent() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF7A28] via-[#FFBE3B] to-[#0078B7] rounded-full opacity-20 blur-2xl" />
          <div className="relative w-full h-full bg-white rounded-full shadow-2xl flex items-center justify-center">
            <Compass className="w-16 h-16 text-[#FF7A28]" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-[#0A2E4D] mb-4">Bem-vindo ao Partnership App</h1>
        <p className="text-lg text-gray-600 mb-8">
          Gerencie suas parcerias, comissões e indicações de forma simples e eficiente.
          <br />
          Faça login para acessar a plataforma.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-gradient-to-br from-[#FF7A28] to-[#FFBE3B] rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-bold text-[#0A2E4D] mb-2">Dashboard Completo</h3>
            <p className="text-sm text-gray-600">Acompanhe todas as métricas em tempo real</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-gradient-to-br from-[#FFBE3B] to-[#0078B7] rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="font-bold text-[#0A2E4D] mb-2">Gestão de Comissões</h3>
            <p className="text-sm text-gray-600">Controle total sobre pagamentos e saques</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-gradient-to-br from-[#0078B7] to-[#FF7A28] rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-bold text-[#0A2E4D] mb-2">Programas de Parceria</h3>
            <p className="text-sm text-gray-600">Crie e gerencie seus programas personalizados</p>
          </div>
        </div>
      </div>
    </div>
  )
}
