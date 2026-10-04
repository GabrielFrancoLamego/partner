"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CheckCircle, XCircle, Loader2, Upload, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type VoucherBenefit = {
  clientName: string | null
  promotion: { title: string; description: string; bannerUrl: string | null; offerType: string; creditAmount: string | null }
}
const OFFER_TYPE_LABELS: Record<string, string> = {
  DISCOUNT: "Desconto",
  FREE_GIFT: "Brinde",
  DOUBLE_BENEFIT: "Pediu 1, levou 2",
  CASH_CREDIT: "Crédito na comanda",
}

const READER_ELEMENT_ID = "scanner-camera-reader"

/**
 * Leitor de QR Code via câmera do celular (html5-qrcode/ZXing) — lê um Vale
 * Retorno ("tribuss:voucher:<code>"), pede o valor da conta e dá baixa
 * imediata via POST /api/company/scanner/redeem, tornando o QR utilizado.
 */
export function CameraRedeemTab() {
  const [isScanning, setIsScanning] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [scannedPayload, setScannedPayload] = useState<string | null>(null)
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  const startScanning = async () => {
    setCameraError("")
    setScannedPayload(null)

    // Navegadores só expõem a câmera (getUserMedia) em contexto seguro —
    // HTTPS ou localhost. Acessar por um IP de rede local em HTTP (ex:
    // http://192.168.x.x:3000, comum ao testar pelo celular na mesma Wi-Fi)
    // faz `navigator.mediaDevices` nem existir, travando o app com um erro
    // genérico se não checarmos isso antes. Ver `npm run dev:https`.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "A câmera só funciona em conexão segura (HTTPS) ou em \"localhost\". Acessando por http://IP:3000 no celular, o navegador bloqueia a câmera por segurança — rode `npm run dev:https` no computador e acesse com https:// no celular (aceite o aviso de certificado).",
      )
      return
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode(READER_ELEMENT_ID)
      scannerRef.current = scanner
      setIsScanning(true)
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setScannedPayload(decodedText)
          scanner.stop().catch(() => {})
          setIsScanning(false)
        },
        () => {
          // erro de leitura por frame — ignorado, tenta o próximo frame
        },
      )
    } catch (err) {
      const name = err instanceof Error ? err.name : ""
      const message =
        name === "NotAllowedError"
          ? "Permissão de câmera negada. Nas configurações do navegador/site, permita o acesso à câmera e tente de novo."
          : name === "NotFoundError"
            ? "Nenhuma câmera foi encontrada neste dispositivo."
            : name === "NotReadableError"
              ? "A câmera já está sendo usada por outro aplicativo. Feche-o e tente novamente."
              : "Não foi possível acessar a câmera. Verifique a permissão do navegador."
      setCameraError(message)
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    await scannerRef.current?.stop().catch(() => {})
    setIsScanning(false)
  }

  if (scannedPayload) {
    return <RedeemForm qrPayload={scannedPayload} onDone={() => setScannedPayload(null)} />
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center space-y-4">
      <div id={READER_ELEMENT_ID} className={isScanning ? "rounded-xl overflow-hidden" : "hidden"} />
      {!isScanning && (
        <>
          <Camera className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-sm text-gray-500">Aponte a câmera para o QR Code do Vale Retorno do cliente</p>
          <Button onClick={startScanning} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            <Camera className="h-4 w-4 mr-1.5" /> Abrir Câmera
          </Button>
        </>
      )}
      {isScanning && (
        <Button variant="outline" onClick={stopScanning}>
          Cancelar leitura
        </Button>
      )}
      {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
    </div>
  )
}

function RedeemForm({ qrPayload, onDone }: { qrPayload: string; onDone: () => void }) {
  const [clientName, setClientName] = useState("")
  const [amount, setAmount] = useState("")
  const [justification, setJustification] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<string | null>(null)
  const [benefit, setBenefit] = useState<VoucherBenefit | null>(null)
  const [lookupError, setLookupError] = useState("")
  const [isLookingUp, setIsLookingUp] = useState(true)

  const code = qrPayload.match(/^tribuss:voucher:(.+)$/)?.[1]

  useEffect(() => {
    if (!code) {
      setIsLookingUp(false)
      return
    }
    adminFetch<VoucherBenefit>(`/api/company/scanner/vouchers/lookup?code=${encodeURIComponent(code)}`)
      .then((b) => {
        setBenefit(b)
        if (b.clientName) setClientName(b.clientName)
      })
      .catch((e) => setLookupError(e instanceof AdminApiError ? e.message : "Erro ao consultar o Vale Retorno"))
      .finally(() => setIsLookingUp(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const isZero = amount !== "" && Number(amount) === 0
  const canSubmit = amount !== "" && Number(amount) >= 0 && (!isZero || justification.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError("")
    try {
      const body = new FormData()
      body.append("qrPayload", qrPayload)
      if (clientName.trim()) body.append("clientName", clientName.trim())
      body.append("amount", amount)
      if (isZero) body.append("billJustification", justification.trim())
      if (file) body.append("file", file)
      const result = await adminFetch<{ promotionTitle: string }>("/api/company/scanner/redeem", { method: "POST", body })
      setSuccess(result.promotionTitle)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao dar baixa no Vale Retorno")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center space-y-3">
        <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
        <p className="font-bold text-green-800">Vale Retorno utilizado com sucesso!</p>
        <p className="text-sm text-gray-500">{success}</p>
        <Button onClick={onDone} className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          Ler outro QR Code
        </Button>
      </div>
    )
  }

  if (!qrPayload.startsWith("tribuss:voucher:")) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-red-200 p-6 text-center space-y-3">
        <XCircle className="w-12 h-12 mx-auto text-red-600" />
        <p className="font-bold text-red-800">QR Code não reconhecido</p>
        <p className="text-sm text-gray-500">Este código não é um Vale Retorno válido da Tribuss.</p>
        <Button variant="outline" onClick={onDone}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isLookingUp) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (lookupError) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-red-200 p-6 text-center space-y-3">
        <XCircle className="w-12 h-12 mx-auto text-red-600" />
        <p className="font-bold text-red-800">{lookupError}</p>
        <Button variant="outline" onClick={onDone}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
      <p className="font-bold text-[#3E2415]">QR Code lido — confirme os dados do resgate</p>

      {benefit && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <Gift className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-800">{benefit.promotion.title}</p>
            <p className="text-xs text-green-700">
              {OFFER_TYPE_LABELS[benefit.promotion.offerType] ?? benefit.promotion.offerType}
              {benefit.promotion.offerType === "CASH_CREDIT" && benefit.promotion.creditAmount ? `: R$ ${benefit.promotion.creditAmount}` : ""}
            </p>
            {benefit.promotion.description && <p className="text-xs text-gray-600 mt-1">{benefit.promotion.description}</p>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Nome do cliente (opcional)</Label>
        <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Valor Total da Conta *</Label>
        <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
      </div>
      {isZero && (
        <div className="space-y-2">
          <Label className="text-amber-700">Justificativa (obrigatória para conta R$ 0,00) *</Label>
          <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Foto da comanda (opcional)</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 text-center">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" id="voucher-receipt" />
          <label htmlFor="voucher-receipt" className="cursor-pointer flex items-center justify-center gap-2 text-sm text-gray-500">
            <Upload className="h-4 w-4" /> {file ? file.name : "Enviar foto"}
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Usar Voucher
        </Button>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
