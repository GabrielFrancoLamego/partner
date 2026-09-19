"use client"

import { useState, useEffect, useRef } from "react"
import { Gift, Star, AlertCircle, CheckCircle, XCircle, Search, Upload, Loader2, Users } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type Promotion = {
  id: string
  title: string
  description: string
  bannerUrl: string | null
  cost: string
  stock: number | null
  usedCount: number
  validUntil: string
}

type PartnerOption = {
  id: string
  name: string
  partnerProfile: { fullName: string | null; nickname: string | null; photoUrl: string | null } | null
}

type CreatedCommission = {
  id: string
  commissionValue: string
  amount: string | null
  partner: { name: string }
  promotion: { title: string } | null
}

type Mode = "PROMOTION" | "REFERRAL"

const currency = (value: string | number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export function QRScannerContent() {
  const [hasProgram, setHasProgram] = useState<boolean | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  useEffect(() => {
    adminFetch<{ status: string } | null>("/api/company/program")
      .then((p) => setHasProgram(Boolean(p && p.status !== "ARCHIVED")))
      .catch(() => setHasProgram(false))
  }, [])

  if (mode === null) {
    return <ModeSelector hasProgram={hasProgram} onSelect={setMode} />
  }

  return <RegistrationFlow mode={mode} onBack={() => setMode(null)} />
}

function ModeSelector({ hasProgram, onSelect }: { hasProgram: boolean | null; onSelect: (mode: Mode) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#3E2415]">Scanner PDV</h2>
        <p className="text-sm text-gray-600 mt-1">O que você quer registrar?</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => onSelect("PROMOTION")}
          className="text-left rounded-2xl border-2 border-gray-200 hover:border-[#F58220] transition-colors p-5 bg-white"
        >
          <Gift className="w-8 h-8 text-[#F58220] mb-2" />
          <p className="font-bold text-[#3E2415]">Resgatar Promoção</p>
          <p className="text-xs text-gray-500 mt-1">Cliente indicado usando um benefício/promoção ativa.</p>
        </button>
        <button
          onClick={() => hasProgram && onSelect("REFERRAL")}
          disabled={!hasProgram}
          className="text-left rounded-2xl border-2 border-gray-200 hover:border-[#F58220] transition-colors p-5 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Star className="w-8 h-8 text-[#F58220] mb-2" />
          <p className="font-bold text-[#3E2415]">Registrar Indicação</p>
          <p className="text-xs text-gray-500 mt-1">
            {hasProgram === false
              ? "Empresa sem Programa de Parceria ativo."
              : "Cliente indicado por um parceiro, sem promoção específica — comissão calculada pelo Programa de Parceria."}
          </p>
        </button>
      </div>
    </div>
  )
}

/** Campo de Valor Total da Conta — obrigatório mesmo em comissão fixa, para registro do faturamento gerado; 0,00 exige justificativa. */
function BillAmountField({
  amount,
  setAmount,
  justification,
  setJustification,
}: {
  amount: string
  setAmount: (v: string) => void
  justification: string
  setJustification: (v: string) => void
}) {
  const isZero = amount !== "" && Number(amount) === 0
  return (
    <div className="space-y-2">
      <Label htmlFor="billAmount">Valor Total da Conta do Cliente *</Label>
      <Input
        id="billAmount"
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        className="rounded-lg"
      />
      <p className="text-xs text-gray-400">Registrado mesmo em comissão fixa, para fins de faturamento gerado pela indicação.</p>
      {isZero && (
        <div className="space-y-1">
          <Label htmlFor="billJustification" className="text-amber-700">
            Justificativa (obrigatória para conta R$ 0,00) *
          </Label>
          <Textarea
            id="billJustification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex: cliente desistiu antes de consumir / não gostou do atendimento"
            className="rounded-lg"
          />
        </div>
      )}
    </div>
  )
}

function RegistrationFlow({ mode, onBack }: { mode: Mode; onBack: () => void }) {
  const [promotions, setPromotions] = useState<Promotion[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null)

  const [clientName, setClientName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [billAmount, setBillAmount] = useState("")
  const [billJustification, setBillJustification] = useState("")
  const [partnerQuery, setPartnerQuery] = useState("")
  const [partnerResults, setPartnerResults] = useState<PartnerOption[]>([])
  const [selectedPartner, setSelectedPartner] = useState<PartnerOption | null>(null)
  const [isSearchingPartners, setIsSearchingPartners] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null)
  const [createdCommission, setCreatedCommission] = useState<CreatedCommission | null>(null)

  useEffect(() => {
    if (mode !== "PROMOTION") return
    adminFetch<Promotion[]>("/api/promotions")
      .then(setPromotions)
      .catch((e) => setLoadError(e instanceof AdminApiError ? e.message : "Erro ao carregar promoções"))
  }, [mode])

  useEffect(() => {
    if (!partnerQuery.trim()) {
      setPartnerResults([])
      return
    }
    setIsSearchingPartners(true)
    const timer = setTimeout(() => {
      adminFetch<PartnerOption[]>(`/api/partners?q=${encodeURIComponent(partnerQuery)}`)
        .then(setPartnerResults)
        .catch(() => setPartnerResults([]))
        .finally(() => setIsSearchingPartners(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [partnerQuery])

  const resetAll = () => {
    setSelectedPromotion(null)
    setClientName("")
    setCustomerPhone("")
    setBillAmount("")
    setBillJustification("")
    setPartnerQuery("")
    setPartnerResults([])
    setSelectedPartner(null)
    setFile(null)
    setSubmitError("")
    setDeniedMessage(null)
    setCreatedCommission(null)
  }

  const billValid = billAmount !== "" && Number(billAmount) >= 0 && (Number(billAmount) > 0 || billJustification.trim().length > 0)
  const canSubmit =
    (mode === "PROMOTION" ? Boolean(selectedPromotion) : true) &&
    Boolean(selectedPartner) &&
    clientName.trim() &&
    customerPhone.trim() &&
    billValid &&
    Boolean(file)

  const handleSubmit = async () => {
    if (!selectedPartner || !clientName.trim() || !customerPhone.trim() || !file || !billValid) return
    if (mode === "PROMOTION" && !selectedPromotion) return
    setIsSubmitting(true)
    setSubmitError("")
    try {
      const body = new FormData()
      if (mode === "PROMOTION" && selectedPromotion) body.append("promotionId", selectedPromotion.id)
      body.append("partnerId", selectedPartner.id)
      body.append("clientName", clientName.trim())
      body.append("customerPhone", customerPhone.trim())
      body.append("amount", billAmount)
      if (Number(billAmount) === 0) body.append("billJustification", billJustification.trim())
      body.append("file", file)

      const commission = await adminFetch<CreatedCommission>("/api/commissions", { method: "POST", body })
      setCreatedCommission(commission)
      if (selectedPromotion) {
        setPromotions((prev) =>
          prev ? prev.map((p) => (p.id === selectedPromotion.id ? { ...p, usedCount: p.usedCount + 1 } : p)) : prev,
        )
      }
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409) {
        setDeniedMessage(e.message)
      } else {
        setSubmitError(e instanceof AdminApiError ? e.message : "Erro ao registrar comissão")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const readyForDetails = mode === "REFERRAL" || Boolean(selectedPromotion)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#3E2415]">{mode === "PROMOTION" ? "Resgatar Promoção" : "Registrar Indicação"}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {mode === "PROMOTION" ? "Registre o uso de uma promoção pelo cliente indicado" : "Cliente indicado por um parceiro ao Programa de Parceria"}
          </p>
        </div>
        {!createdCommission && !deniedMessage && (
          <Button variant="outline" size="sm" onClick={onBack}>
            Trocar
          </Button>
        )}
      </div>

      {mode === "PROMOTION" && !selectedPromotion && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-[#3E2415] mb-4">Selecione a promoção usada pelo cliente</h3>

          {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

          {!promotions && !loadError && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {promotions && promotions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Gift className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma promoção ativa no momento</p>
            </div>
          )}

          {promotions && promotions.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {promotions.map((promo) => (
                <button
                  key={promo.id}
                  onClick={() => setSelectedPromotion(promo)}
                  className="text-left rounded-xl border-2 border-gray-200 hover:border-[#F58220] transition-colors overflow-hidden"
                >
                  <div className="h-28 bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] relative">
                    {promo.bannerUrl && <img src={promo.bannerUrl} alt={promo.title} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-[#3E2415]">{promo.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{promo.description}</p>
                    <p className="text-sm font-bold text-[#F58220] mt-2">{currency(promo.cost)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {readyForDetails && !createdCommission && !deniedMessage && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6">
            {selectedPromotion && (
              <div className="flex items-center gap-2 mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-800">{selectedPromotion.title}</p>
                  <p className="text-sm text-green-600">Comissão: {currency(selectedPromotion.cost)}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="customerName">Nome Completo do Cliente *</Label>
                <Input id="customerName" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Digite o nome completo" className="rounded-lg" />
              </div>

              <div>
                <Label htmlFor="customerPhone">Telefone do Cliente *</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="rounded-lg"
                />
              </div>

              <BillAmountField amount={billAmount} setAmount={setBillAmount} justification={billJustification} setJustification={setBillJustification} />

              <div>
                <Label>Parceiro que indicou *</Label>
                {selectedPartner ? (
                  <div className="flex items-center justify-between gap-3 mt-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <span className="text-sm font-semibold text-[#3E2415]">
                      {selectedPartner.partnerProfile?.fullName ?? selectedPartner.name}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPartner(null)}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={partnerQuery}
                      onChange={(e) => setPartnerQuery(e.target.value)}
                      placeholder="Buscar por nome ou apelido..."
                      className="pl-9 rounded-lg"
                    />
                    {isSearchingPartners && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                    {partnerResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {partnerResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setSelectedPartner(p)
                              setPartnerQuery("")
                              setPartnerResults([])
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 text-sm"
                          >
                            <Users className="h-4 w-4 text-gray-400" />
                            {p.partnerProfile?.fullName ?? p.name}
                            {p.partnerProfile?.nickname && <span className="text-gray-400">@{p.partnerProfile.nickname}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Foto da Comanda / Comprovante de Consumo *</Label>
                <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-[#F58220] transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="comanda-upload"
                  />
                  <label htmlFor="comanda-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">{file ? file.name : "Clique para enviar (JPG, PNG, PDF)"}</p>
                  </label>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl py-3 shadow-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Confirmar e Registrar
              </Button>
              <Button onClick={mode === "PROMOTION" ? () => setSelectedPromotion(null) : onBack} variant="outline" className="rounded-xl border-gray-300 px-6">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {createdCommission && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-800">Comissão registrada com sucesso</h3>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-semibold">Parceiro:</span> {createdCommission.partner.name}
            </p>
            {createdCommission.promotion && (
              <p className="text-gray-600">
                <span className="font-semibold">Promoção:</span> {createdCommission.promotion.title}
              </p>
            )}
            {createdCommission.amount !== null && (
              <p className="text-gray-600">
                <span className="font-semibold">Valor da conta:</span> {currency(createdCommission.amount)}
              </p>
            )}
            <p className="text-gray-600">
              <span className="font-semibold">Valor da comissão:</span> {currency(createdCommission.commissionValue)}
            </p>
            <p className="text-gray-400 text-xs mt-2">Aguardando aprovação do financeiro.</p>
          </div>
          <Button
            onClick={resetAll}
            className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl py-3"
          >
            Registrar outro cliente
          </Button>
        </div>
      )}

      {deniedMessage && (
        <div className="bg-white rounded-2xl shadow-md border border-red-200 p-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-red-800">Promoção Negada</h3>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-semibold mb-2">⚠️ Cliente já utilizou promoção recentemente</p>
            <p className="text-sm text-red-700">{deniedMessage}</p>
          </div>

          <Button
            onClick={resetAll}
            className="w-full bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl py-3"
          >
            Voltar
          </Button>
        </div>
      )}
    </div>
  )
}
