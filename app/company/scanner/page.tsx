"use client"

import { QrCode, ClipboardEdit, Gift, History } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { QRScannerContent } from "@/components/qr-scanner-content"
import { CameraRedeemTab } from "@/components/company/scanner/camera-redeem-tab"
import { ValeRetornoTab } from "@/components/company/scanner/vale-retorno-tab"
import { HistoryTab } from "@/components/company/scanner/history-tab"
import { useCompanyUser } from "@/lib/company-user-context"

/**
 * Scanner PDV — acesso integral para MASTER, GERENTE e COLABORADOR
 * (canOperateFrontDesk). 4 frentes: leitor de câmera (Vale Retorno), registro
 * manual (promoção/indicação), emissão de Vale Retorno e histórico de resgates.
 */
export default function CompanyScannerPage() {
  const user = useCompanyUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Scanner PDV</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Leia QR Codes, registre promoções, emita Vale Retorno e acompanhe o histórico de resgates
          {user.role === "COMPANY_MASTER" && " — acesso completo do Master"}
        </p>
      </div>

      <Tabs defaultValue="camera">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="camera">
            <QrCode className="h-4 w-4 mr-1.5" /> Leitor QR
          </TabsTrigger>
          <TabsTrigger value="manual">
            <ClipboardEdit className="h-4 w-4 mr-1.5" /> Registro Manual
          </TabsTrigger>
          <TabsTrigger value="vale-retorno">
            <Gift className="h-4 w-4 mr-1.5" /> Vale Retorno
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="camera">
            <CameraRedeemTab />
          </TabsContent>
          <TabsContent value="manual">
            <QRScannerContent />
          </TabsContent>
          <TabsContent value="vale-retorno">
            <ValeRetornoTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
