"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

export const currencyNum = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
export const formatDate = (value: string | Date | null | undefined) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—")
export const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"

export type PaymentMethod = "PIX" | "DINHEIRO" | "TRANSFERENCIA" | "CONSUMO"
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência Bancária",
  CONSUMO: "Consumo Interno",
}

export type RecipientBanking = {
  fullName: string
  document: string | null
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
  pixKey: string | null
}

/** Situação de um vencimento em relação a hoje — usada para destacar o que precisa de ação. */
export function dueStatus(date: string | Date): { label: string; tone: "overdue" | "today" | "future" } {
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (due.getTime() < today.getTime()) return { label: "Vencida", tone: "overdue" }
  if (due.getTime() === today.getTime()) return { label: "Vence hoje", tone: "today" }
  return { label: "A vencer", tone: "future" }
}

const DUE_TONE_CLASS = {
  overdue: "bg-red-50 text-red-700",
  today: "bg-amber-50 text-amber-700",
  future: "bg-gray-100 text-gray-600",
} as const

export function DueBadge({ date }: { date: string | Date }) {
  const { label, tone } = dueStatus(date)
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${DUE_TONE_CLASS[tone]}`}>{label}</span>
}

/** Contador ao lado do título de sub-aba — fica vermelho quando há algo vencendo hoje. */
export function CountBadge({ count, urgent, title }: { count: number; urgent?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`ml-1.5 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        urgent && count > 0 ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"
      }`}
    >
      {count}
    </span>
  )
}

/** Visualizador de comprovante — imagem inline ou PDF embutido, com link para abrir em nova aba. */
export function ProofViewer({ url }: { url: string }) {
  const isPdf = /\.pdf($|\?)/i.test(url)
  return (
    <div className="space-y-2">
      {isPdf ? (
        <iframe src={url} title="Comprovante" className="w-full h-80 rounded-lg border border-gray-200" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Comprovante de pagamento" className="max-h-80 w-full object-contain rounded-lg border border-gray-200 bg-gray-50" />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#F58220] hover:underline">
        <FileText className="h-3.5 w-3.5" /> Abrir comprovante em nova aba <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!value) return
    await navigator.clipboard?.writeText(value).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-medium text-[#3E2415] break-all">{value ?? "—"}</p>
      </div>
      {value && (
        <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={copy} title="Copiar">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  )
}

/** Gaveta com os dados do favorecido e bancários/PIX para efetuar o pagamento. */
export function RecipientDrawer({
  banking,
  title,
  details,
  onClose,
}: {
  banking: RecipientBanking
  title: string
  details?: { label: string; value: string }[]
  onClose: () => void
}) {
  const hasBanking = banking.bankName || banking.agency || banking.accountNumber || banking.pixKey
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Dados do favorecido para efetuar o pagamento</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <CopyField label="Nome completo do favorecido" value={banking.fullName} />
          <CopyField label="CPF/CNPJ" value={banking.document} />
          <CopyField label="Banco" value={banking.bankName} />
          <CopyField label="Agência" value={banking.agency} />
          <CopyField label={`Conta${banking.accountType ? ` (${banking.accountType.toLowerCase()})` : ""}`} value={banking.accountNumber} />
          <CopyField label="Chave PIX" value={banking.pixKey} />
          {!hasBanking && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mt-3">Este favorecido ainda não tem dados bancários/PIX cadastrados.</p>}
          {details && details.length > 0 && (
            <div className="mt-4 rounded-xl bg-gray-50 p-3 space-y-1.5">
              {details.map((d) => (
                <div key={d.label} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-500">{d.label}</span>
                  <span className="font-semibold text-[#3E2415] text-right">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Modal de pagamento: forma de pagamento + comprovante OBRIGATÓRIO (PNG/JPG/PDF)
 * enviados por multipart ao `endpoint`, junto de `extraFields`. Ao confirmar, o
 * item sai da lista e entra no Registro de Quitação.
 */
export function PayDialog({
  title,
  description,
  amount,
  endpoint,
  extraFields,
  consumoAllowed,
  recipient,
  onClose,
  onDone,
}: {
  title: string
  description?: string
  amount: number
  endpoint: string
  extraFields: Record<string, string>
  consumoAllowed: boolean
  recipient?: RecipientBanking
  onClose: () => void
  onDone: () => void
}) {
  const [method, setMethod] = useState<PaymentMethod | "">("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!method) return setError("Selecione a forma de pagamento")
    if (!file) return setError("Anexe o comprovante de pagamento (PNG, JPG ou PDF)")
    setIsSubmitting(true)
    try {
      const body = new FormData()
      Object.entries(extraFields).forEach(([k, v]) => body.append(k, v))
      body.append("paymentMethod", method)
      body.append("file", file)
      await adminFetch(endpoint, { method: "POST", body })
      onDone()
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erro ao registrar o pagamento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? "Informe a forma de pagamento e anexe o comprovante para quitar."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Valor a pagar</span>
              <span className="font-bold text-[#3E2415]">{currencyNum(amount)}</span>
            </div>
            {recipient && (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Favorecido</span>
                  <span className="font-medium text-[#3E2415] text-right">{recipient.fullName}</span>
                </div>
                {recipient.document && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">CPF/CNPJ</span>
                    <span className="text-right">{recipient.document}</span>
                  </div>
                )}
                {recipient.pixKey && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Chave PIX</span>
                    <span className="text-right break-all">{recipient.pixKey}</span>
                  </div>
                )}
                {(recipient.bankName || recipient.agency || recipient.accountNumber) && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Banco/Ag./Conta</span>
                    <span className="text-right">
                      {[recipient.bankName, recipient.agency, recipient.accountNumber].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m} disabled={m === "CONSUMO" && !consumoAllowed}>
                    {PAYMENT_METHOD_LABELS[m]}
                    {m === "CONSUMO" && !consumoAllowed ? " (só colaboradores)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Comprovante de pagamento (obrigatório)</Label>
            <Input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-[11px] text-gray-400">Imagem PNG/JPG ou arquivo PDF, até 8MB.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
