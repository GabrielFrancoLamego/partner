"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, Loader2, MessageCircle, Share2, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/validators"
import { VoucherDisplay, type VoucherDisplayProps } from "@/components/shared/voucher-display"

type Option = { id: string; name: string; address: string; promotions: { id: string; title: string; benefit: string; validUntil: string }[] }

type Result = {
  voucher: { code: string; clientName: string }
  qrDataUrl: string
  voucherUrl: string
  message: string
  emailSent: boolean
  whatsappUrl: string | null
  noContact: boolean
  display: Omit<VoucherDisplayProps, "qrDataUrl">
}

export const GENERATE_VOUCHER_EVENT = "partner:generate-voucher"
export type GenerateVoucherPreset = { companyId?: string; promotionId?: string }

async function dataUrlToFile(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], filename, { type: "image/png" })
}

/**
 * Gerador de voucher sem fricção (botão [+ GERAR VOUCHER]): estabelecimento →
 * promoção → nome do cliente + UM contato (e-mail OU telefone/WhatsApp), ou
 * "Cliente sem e-mail/WhatsApp" (só o nome). Mostra o QR em tamanho grande e
 * oferece compartilhar/enviar por WhatsApp.
 */
export function GenerateVoucherDialog({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (open: boolean) => void; preset?: GenerateVoucherPreset }) {
  const [options, setOptions] = useState<Option[] | null>(null)
  const [companyId, setCompanyId] = useState("")
  const [promotionId, setPromotionId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [noContact, setNoContact] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || options) return
    adminFetch<Option[]>("/api/partner/vouchers")
      .then(setOptions)
      .catch(() => setOptions([]))
  }, [open, options])

  // Pré-seleção (vinda de "Enviar ao Cliente" numa promoção) ou única opção disponível.
  useEffect(() => {
    if (!open || !options) return
    const presetCompany = preset?.companyId && options.some((o) => o.id === preset.companyId) ? preset.companyId : options.length === 1 ? options[0].id : ""
    if (presetCompany && !companyId) {
      setCompanyId(presetCompany)
      const company = options.find((o) => o.id === presetCompany)
      if (preset?.promotionId && company?.promotions.some((p) => p.id === preset.promotionId)) setPromotionId(preset.promotionId)
      else if (company?.promotions.length === 1) setPromotionId(company.promotions[0].id)
    }
  }, [open, options, preset, companyId])

  const company = options?.find((o) => o.id === companyId)

  const reset = () => {
    setResult(null)
    setClientName("")
    setClientEmail("")
    setClientPhone("")
    setNoContact(false)
    setError("")
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!companyId) return setError("Selecione o estabelecimento")
    if (!promotionId) return setError("Selecione a promoção")
    if (!clientName.trim()) return setError("Informe o nome do cliente")
    if (!noContact) {
      if (!clientEmail.trim() && !clientPhone.trim()) return setError("Informe o e-mail OU o telefone/WhatsApp — ou marque \"Cliente sem e-mail/WhatsApp\"")
      if (clientEmail.trim() && !isValidEmail(clientEmail.trim())) return setError("E-mail do cliente inválido")
      if (clientPhone.trim() && !isValidPhone(clientPhone.trim())) return setError("Telefone/WhatsApp inválido — inclua o DDD")
    }

    setIsSubmitting(true)
    try {
      const created = await adminFetch<{
        voucher: { code: string; clientName: string }
        qrDataUrl: string
        voucherUrl: string
        message: string
        emailSent: boolean
        whatsappUrl: string | null
      }>("/api/partner/vouchers", {
        method: "POST",
        body: JSON.stringify({ companyId, promotionId, clientName: clientName.trim(), clientEmail: clientEmail.trim(), clientPhone: clientPhone.trim(), noContact }),
      })
      // Mesma visão que o cliente verá no link (endereço, rota e telefone do estabelecimento).
      const pub = await adminFetch<{
        clientName: string | null
        partnerName: string | null
        expiresAt: string | null
        promotion: { title: string; benefit: string }
        company: VoucherDisplayProps["company"]
      }>(`/api/public/vouchers/${created.voucher.code}`)
      setResult({
        ...created,
        noContact,
        display: {
          clientName: pub.clientName,
          partnerName: pub.partnerName,
          promotionTitle: pub.promotion.title,
          benefit: pub.promotion.benefit,
          validUntil: pub.expiresAt,
          company: pub.company,
        },
      })
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao gerar o voucher")
    } finally {
      setIsSubmitting(false)
    }
  }

  const share = async () => {
    if (!result) return
    try {
      if (navigator.share) {
        const file = await dataUrlToFile(result.qrDataUrl, `voucher-${result.voucher.code}.png`)
        const canShareFile = navigator.canShare?.({ files: [file] })
        await navigator.share(canShareFile ? { title: "Seu voucher", text: result.message, files: [file] } : { title: "Seu voucher", text: result.message, url: result.voucherUrl })
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(result.message)}`, "_blank")
  }

  const copyLink = async () => {
    if (!result) return
    await navigator.clipboard?.writeText(result.voucherUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[94dvh] md:h-auto md:max-h-[92vh] md:max-w-xl md:mx-auto md:rounded-2xl rounded-t-3xl overflow-y-auto overflow-x-hidden p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-[#F2680C]" /> {result ? "Voucher gerado!" : "Gerar voucher"}
          </SheetTitle>
          <SheetDescription>{result ? `Para ${result.voucher.clientName}` : "Rápido: estabelecimento, promoção e o contato do cliente."}</SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
          {result ? (
            <div className="space-y-4">
              {result.emailSent && <p className="text-sm text-green-700 bg-green-50 rounded-xl p-3">✓ O voucher também foi enviado por e-mail ao cliente.</p>}
              {result.noContact && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">Sem contato informado: mostre este QR Code ao cliente — ele pode tirar uma foto da tela.</p>}

              <VoucherDisplay qrDataUrl={result.qrDataUrl} {...result.display} hideActions={!result.noContact} />

              <div className="space-y-2.5">
                {result.whatsappUrl ? (
                  <>
                    <Button asChild className="w-full min-h-12 bg-green-600 hover:bg-green-700 text-white text-base">
                      <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-5 w-5 mr-2" /> Enviar por WhatsApp
                      </a>
                    </Button>
                    <Button type="button" variant="outline" onClick={share} className="w-full min-h-11">
                      <Share2 className="h-4 w-4 mr-2" /> Compartilhar imagem do QR Code
                    </Button>
                  </>
                ) : (
                  <Button type="button" onClick={share} className="w-full min-h-12 bg-green-600 hover:bg-green-700 text-white text-base">
                    <Share2 className="h-5 w-5 mr-2" /> Compartilhar / Enviar por WhatsApp
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={copyLink} className="w-full min-h-11">
                  {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />} {copied ? "Link copiado" : "Copiar link do voucher"}
                </Button>
                <Button type="button" variant="ghost" onClick={reset} className="w-full min-h-11">
                  Gerar outro voucher
                </Button>
              </div>
            </div>
          ) : !options ? (
            <p className="text-center text-sm text-gray-400 py-10">Carregando...</p>
          ) : options.length === 0 ? (
            <div className="text-center space-y-3 py-6">
              <p className="text-sm text-gray-600">Você ainda não aderiu ao Programa de Parceria de nenhum estabelecimento.</p>
              <Button asChild className="min-h-11 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white" onClick={() => handleOpenChange(false)}>
                <Link href="/partner/promocoes?tab=descobrir">Descobrir promoções e aderir</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}

              <div className="space-y-1.5">
                <Label>Estabelecimento</Label>
                <Select
                  value={companyId}
                  onValueChange={(v) => {
                    setCompanyId(v)
                    const c = options.find((o) => o.id === v)
                    setPromotionId(c?.promotions.length === 1 ? c.promotions[0].id : "")
                  }}
                >
                  <SelectTrigger className="w-full min-h-11">
                    <SelectValue placeholder="Selecione o estabelecimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Promoção</Label>
                <Select value={promotionId} onValueChange={setPromotionId} disabled={!company}>
                  <SelectTrigger className="w-full min-h-11">
                    <SelectValue placeholder={company ? "Selecione a promoção" : "Escolha o estabelecimento primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {company?.promotions.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Nenhuma promoção vigente neste estabelecimento.</div>}
                    {company?.promotions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} — {p.benefit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Nome do cliente indicado *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: Maria Silva" autoComplete="off" className="min-h-11" />
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 min-h-12 cursor-pointer">
                <span className="text-sm font-medium text-[#3E2415]">Cliente sem e-mail/WhatsApp</span>
                <Switch checked={noContact} onCheckedChange={setNoContact} />
              </label>

              {!noContact && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Informe pelo menos um contato — e-mail OU telefone/WhatsApp (não precisa dos dois).</p>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input type="email" inputMode="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" className="min-h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input type="tel" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" className="min-h-11" />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full min-h-12 text-base bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
                {isSubmitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Ticket className="h-5 w-5 mr-2" />} Gerar voucher
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
