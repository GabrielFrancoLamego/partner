import type { Metadata } from "next"
import { WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "Sem conexão — Tribuss",
}

/**
 * Fallback exibido pelo Service Worker (public/sw.js) quando uma navegação
 * falha por falta de rede e não há versão em cache da página pedida.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F7F5F2] px-6 text-center safe-top safe-bottom">
      <img src="/brand/tribuss-icone-app.png" alt="Tribuss" className="w-16 h-16 rounded-2xl object-contain" />
      <div className="flex items-center gap-2 text-[#3E2415]">
        <WifiOff className="h-5 w-5" />
        <h1 className="text-lg font-bold">Você está offline</h1>
      </div>
      <p className="text-sm text-gray-600 max-w-xs">
        Não foi possível carregar esta página sem conexão com a internet. Verifique sua rede e tente novamente.
      </p>
      <a
        href="/"
        className="mt-2 min-h-11 inline-flex items-center justify-center px-6 rounded-xl font-medium text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] shadow-md active:opacity-90"
      >
        Tentar novamente
      </a>
    </div>
  )
}
