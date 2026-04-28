"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, AlertCircle, CheckCircle, XCircle, QrCode } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type QRCodeData = {
  promotionId: string
  qrCodeId: string
  customerEmail: string
  generatedAt: string
  expiresAt: string
}

type ScannedPromotion = {
  id: string
  title: string
  description: string
  bannerUrl: string
  cost: number
  qrCodeId: string
  status: "valid" | "expired" | "used"
  usedAt?: string
  expiresAt: string
}

export function QRScannerContent() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedPromotion, setScannedPromotion] = useState<ScannedPromotion | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [recentUseWarning, setRecentUseWarning] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Simulated QR code scanning - in production, use a QR code library like jsQR
  const simulateScan = (type: "valid" | "expired" | "used") => {
    const mockPromotion: ScannedPromotion = {
      id: "1",
      title: "Happy Hour Especial",
      description: "Desconto de 30% em todas as bebidas das 17h às 19h",
      bannerUrl: "/happy-hour-drinks.png",
      cost: 25.0,
      qrCodeId: "QR-" + Date.now(),
      status: type,
      expiresAt:
        type === "expired"
          ? new Date(Date.now() - 86400000).toISOString()
          : new Date(Date.now() + 900000).toISOString(),
      usedAt: type === "used" ? new Date(Date.now() - 3600000).toISOString() : undefined,
    }

    setScannedPromotion(mockPromotion)
    setIsScanning(false)
    stopCamera()
  }

  const simulateTestScan = () => {
    const mockPromotion: ScannedPromotion = {
      id: "1",
      title: "Happy Hour Especial",
      description: "Desconto de 30% em todas as bebidas das 17h às 19h",
      bannerUrl: "/happy-hour-drinks.png",
      cost: 25.0,
      qrCodeId: "QR-TESTE-" + Date.now(),
      status: "valid",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }

    setScannedPromotion(mockPromotion)
    setIsScanning(false)
    stopCamera()
    // Pre-fill test customer data
    setCustomerName("teste")
    setCustomerPhone("112233")
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setIsScanning(true)
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("Não foi possível acessar a câmera. Verifique as permissões.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsScanning(false)
  }

  const handleUsePromotion = () => {
    if (!scannedPromotion || scannedPromotion.status !== "valid") return
    setShowConfirmation(true)
  }

  const handleConfirmUse = () => {
    const isTestCustomer = customerName.toLowerCase() === "teste" && customerPhone === "112233"
    const hasRecentUse = isTestCustomer ? false : Math.random() > 0.7

    if (hasRecentUse) {
      setRecentUseWarning(
        `Este cliente utilizou uma promoção em 15/11/2024. Aguarde 90 dias desde a última utilização.`,
      )
    } else {
      const newCommission = {
        promotionTitle: scannedPromotion?.title || "",
        customerName: customerName,
        customerPhone: customerPhone,
        qrCodeId: scannedPromotion?.qrCodeId || "",
        acceptedAt: new Date().toISOString(),
        needsBillValue: true,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }

      const pendingCommissions = JSON.parse(localStorage.getItem("pendingCommissions") || "[]")
      pendingCommissions.push(newCommission)
      localStorage.setItem("pendingCommissions", JSON.stringify(pendingCommissions))

      alert(
        `✅ Promoção utilizada com sucesso!\n\n` +
          `Cliente: ${customerName}\n` +
          `Telefone: ${customerPhone}\n\n` +
          `⚠️ IMPORTANTE: Insira o valor da conta em até 24 horas na seção de Comissões (aba "Aguardando Valor")`,
      )
      resetScanner()

      window.dispatchEvent(new Event("storage"))
    }
  }

  const resetScanner = () => {
    setScannedPromotion(null)
    setShowConfirmation(false)
    setCustomerName("")
    setCustomerPhone("")
    setRecentUseWarning(null)
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0A2E4D]">Scanner QR Code</h2>
          <p className="text-sm text-gray-600 mt-1">Escaneie QR codes de promoções para validar e utilizar</p>
        </div>
      </div>

      {/* Scanner Interface */}
      {!scannedPromotion && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {/* Camera View */}
          {isScanning ? (
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full h-[500px] object-cover bg-black" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-4 border-[#FF7A28] rounded-2xl w-64 h-64 bg-transparent opacity-50"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <p className="text-white text-center mb-4">Posicione o QR code dentro do quadrado</p>
                <Button onClick={stopCamera} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#FF7A28] to-[#FFBE3B] rounded-full flex items-center justify-center shadow-xl">
                <QrCode className="w-16 h-16 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#0A2E4D] mb-2">Pronto para escanear</h3>
              <p className="text-gray-600 mb-6">Clique no botão abaixo para abrir a câmera e escanear um QR code</p>
              <Button
                onClick={startCamera}
                className="bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl px-8 py-3 text-lg shadow-lg"
              >
                <Camera className="w-5 h-5 mr-2" />
                Abrir Câmera
              </Button>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-4">Teste com QR codes simulados:</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={simulateTestScan}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xs"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    QR Teste (Cliente: teste / Tel: 112233)
                  </Button>
                  <Button onClick={() => simulateScan("valid")} variant="outline" size="sm" className="text-xs">
                    QR Válido
                  </Button>
                  <Button onClick={() => simulateScan("expired")} variant="outline" size="sm" className="text-xs">
                    QR Expirado
                  </Button>
                  <Button onClick={() => simulateScan("used")} variant="outline" size="sm" className="text-xs">
                    QR Já Usado
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scanned Promotion Display */}
      {scannedPromotion && !showConfirmation && !recentUseWarning && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          {/* Banner */}
          <div className="relative h-48 bg-gradient-to-br from-[#FF7A28] to-[#FFBE3B]">
            <img
              src={scannedPromotion.bannerUrl || "/placeholder.svg"}
              alt={scannedPromotion.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6">
            {/* Status Badge */}
            {scannedPromotion.status === "valid" && (
              <div className="flex items-center gap-2 mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-bold text-green-800">QR Code Válido</p>
                  <p className="text-sm text-green-600">
                    Expira em: {new Date(scannedPromotion.expiresAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            )}

            {scannedPromotion.status === "expired" && (
              <div className="flex items-center gap-2 mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-bold text-red-800">QR Code Expirado</p>
                  <p className="text-sm text-red-600">
                    Expirou em: {new Date(scannedPromotion.expiresAt).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-red-600 mt-1 font-semibold">⚠️ NEGAR esta promoção ao cliente</p>
                </div>
              </div>
            )}

            {scannedPromotion.status === "used" && (
              <div className="flex items-center gap-2 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertCircle className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-bold text-orange-800">QR Code Já Utilizado</p>
                  <p className="text-sm text-orange-600">
                    Usado em:{" "}
                    {scannedPromotion.usedAt
                      ? new Date(scannedPromotion.usedAt).toLocaleString("pt-BR")
                      : "Data não disponível"}
                  </p>
                  <p className="text-sm text-orange-600 mt-1 font-semibold">⚠️ NEGAR esta promoção ao cliente</p>
                </div>
              </div>
            )}

            {/* Promotion Details */}
            <h3 className="text-2xl font-bold text-[#0A2E4D] mb-2">{scannedPromotion.title}</h3>
            <p className="text-gray-600 mb-4">{scannedPromotion.description}</p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">QR Code ID:</span>
                <span className="font-mono font-semibold text-[#0A2E4D]">{scannedPromotion.qrCodeId}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Custo da Promoção:</span>
                <span className="font-bold text-[#FF7A28]">R$ {scannedPromotion.cost.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {scannedPromotion.status === "valid" ? (
                <Button
                  onClick={handleUsePromotion}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl py-6 text-lg shadow-lg"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Usar Promoção
                </Button>
              ) : (
                <Button
                  disabled
                  className="flex-1 bg-gray-300 text-gray-500 rounded-xl py-6 text-lg cursor-not-allowed"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Promoção Inválida
                </Button>
              )}
              <Button
                onClick={resetScanner}
                variant="outline"
                className="rounded-xl border-gray-300 px-6 bg-transparent"
              >
                Voltar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Confirmation */}
      {showConfirmation && !recentUseWarning && (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-6 h-6 text-[#FF7A28]" />
            <h3 className="text-xl font-bold text-[#0A2E4D]">Confirme os Dados do Cliente</h3>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Para validar a promoção, confirme o nome e telefone do cliente. O sistema verificará se ele utilizou alguma
            promoção nos últimos 90 dias.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="customerName">Nome Completo do Cliente *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Digite o nome completo"
                className="rounded-lg"
              />
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
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleConfirmUse}
              disabled={!customerName.trim() || !customerPhone.trim()}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl py-3 shadow-lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirmar e Usar
            </Button>
            <Button
              onClick={() => setShowConfirmation(false)}
              variant="outline"
              className="rounded-xl border-gray-300 px-6"
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {/* Recent Use Warning */}
      {recentUseWarning && (
        <div className="bg-white rounded-2xl shadow-md border border-red-200 p-6 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-red-800">Promoção Negada</h3>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-semibold mb-2">⚠️ Cliente já utilizou promoção recentemente</p>
            <p className="text-sm text-red-700">{recentUseWarning}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 font-medium">Dados do cliente:</p>
            <p className="text-sm text-gray-600 mt-1">Nome: {customerName}</p>
            <p className="text-sm text-gray-600">Telefone: {customerPhone}</p>
          </div>

          <Button
            onClick={resetScanner}
            className="w-full bg-gradient-to-r from-[#FF7A28] to-[#FFBE3B] hover:from-[#FF6A18] hover:to-[#FFAE2B] text-white rounded-xl py-3"
          >
            Escanear Novo QR Code
          </Button>
        </div>
      )}
    </div>
  )
}
