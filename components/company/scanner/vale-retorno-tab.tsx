"use client"

import { useEffect, useState } from "react"
import { Gift, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { EmptyState } from "@/components/admin/admin-ui"

type Promotion = { id: string; title: string; audience: "EXTERNAL" | "INTERNAL" }
type VoucherResult = { qrDataUrl: string; emailSent: boolean; whatsappUrl: string | null }

/** Emite um Vale Retorno (QR de uma Promotion, tipicamente INTERNAL) para o cliente voltar em outra data. */
export function ValeRetornoTab() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [promotionId, setPromotionId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<VoucherResult | null>(null)

  useEffect(() => {
    adminFetch<Promotion[]>("/api/promotions").then(setPromotions)
  }, [])

  const canSubmit = promotionId && (clientPhone.trim() || clientEmail.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError("")
    try {
      const res = await adminFetch<VoucherResult>("/api/company/scanner/vouchers", {
        method: "POST",
        body: JSON.stringify({ promotionId, clientName: clientName.trim() || undefined, clientPhone: clientPhone.trim() || undefined, clientEmail: clientEmail.trim() || undefined }),
      })
      setResult(res)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao emitir Vale Retorno")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (promotions.length === 0) {
    return <EmptyState message="Nenhuma promoção ativa cadastrada. Crie uma promoção (idealmente Interna) em Promoções." />
  }

  if (result) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center space-y-4">
        <p className="font-bold text-[#3E2415]">Vale Retorno emitido!</p>
        <img src={result.qrDataUrl} alt="QR Code do Vale Retorno" className="w-48 h-48 mx-auto rounded-xl border border-gray-100" />
        <div className="flex flex-col items-center gap-2">
          {result.whatsappUrl && (
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Send className="h-4 w-4 mr-1.5" /> Enviar via WhatsApp
              </Button>
            </a>
          )}
          {clientEmail && <p className="text-xs text-gray-500">{result.emailSent ? "E-mail enviado ao cliente." : "E-mail não configurado — copie o QR acima manualmente."}</p>}
        </div>
        <Button variant="outline" onClick={() => { setResult(null); setClientName(""); setClientPhone(""); setClientEmail("") }}>
          Emitir outro Vale Retorno
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-[#F58220]" />
        <p className="font-bold text-[#3E2415]">Emitir Vale Retorno</p>
      </div>
      <p className="text-xs text-gray-500">
        Gera um QR Code de indicação para o cliente voltar em outra data e resgatar o benefício no Scanner.
      </p>
      <div className="space-y-2">
        <Label>Promoção</Label>
        <Select value={promotionId} onValueChange={setPromotionId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a promoção" />
          </SelectTrigger>
          <SelectContent>
            {promotions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} {p.audience === "INTERNAL" && "(Interna)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Nome do cliente (opcional)</Label>
        <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>WhatsApp do cliente</Label>
          <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-2">
          <Label>E-mail (opcional)</Label>
          <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
        {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
        Gerar Vale Retorno
      </Button>
    </div>
  )
}
