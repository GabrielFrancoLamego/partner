"use client"

import dynamic from "next/dynamic"

const ProgramsMap = dynamic(() => import("@/components/public/programs-map").then((m) => m.ProgramsMap), {
  ssr: false,
  loading: () => <div className="h-[70vh] flex items-center justify-center bg-gray-50 rounded-2xl text-sm text-gray-400">Carregando mapa...</div>,
})

export default function PartnerProgramsMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Mapa de Programas</h1>
        <p className="text-gray-600 mt-1 text-sm">Empresas com programa de parceria ativo perto de você.</p>
      </div>
      <ProgramsMap ctaHref={() => "/partner/promocoes"} />
    </div>
  )
}
