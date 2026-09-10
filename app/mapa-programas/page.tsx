"use client"

import dynamic from "next/dynamic"

const ProgramsMap = dynamic(() => import("@/components/public/programs-map").then((m) => m.ProgramsMap), {
  ssr: false,
  loading: () => <div className="h-[70vh] flex items-center justify-center bg-gray-50 rounded-2xl text-sm text-gray-400">Carregando mapa...</div>,
})

export default function PublicProgramsMapPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F2] px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-[#3E2415]">Programas de Parceria Tribuss</h1>
            <p className="text-sm text-gray-500">Encontre empresas perto de você e comece a indicar clientes hoje.</p>
          </div>
        </div>
        <ProgramsMap ctaHref={(slug) => `/join/partner`} />
      </div>
    </div>
  )
}
