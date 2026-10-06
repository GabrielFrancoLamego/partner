"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { MapPin, LocateFixed, Search, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { AdminCard, LoadingState } from "@/components/admin/admin-ui"
import { formatCep, formatPhone, isValidCep } from "@/lib/validators"
import type { LatLng } from "./location-map"

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-gray-50 text-sm text-gray-400">Carregando mapa...</div>,
})

type Location = {
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  latitude: number | null
  longitude: number | null
}

/** Localização exata do estabelecimento: endereço + pin arrastável no mapa + telefone/WhatsApp oficial. */
export function LocationForm() {
  const [form, setForm] = useState<Location | null>(null)
  const [position, setPosition] = useState<LatLng | null>(null)
  const [recenterToken, setRecenterToken] = useState(0)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState<"" | "cep" | "geocode" | "gps" | "save">("")

  useEffect(() => {
    adminFetch<Location>("/api/company/location").then((data) => {
      setForm(data)
      if (data.latitude !== null && data.longitude !== null) setPosition({ latitude: data.latitude, longitude: data.longitude })
    })
  }, [])

  const update = (field: keyof Location, value: string) => {
    setForm((f) => (f ? { ...f, [field]: value } : f))
    setSaved(false)
  }

  const movePin = useCallback((p: LatLng) => {
    setPosition({ latitude: Math.round(p.latitude * 1e6) / 1e6, longitude: Math.round(p.longitude * 1e6) / 1e6 })
    setSaved(false)
    setInfo("")
  }, [])

  const recenter = (p: LatLng) => {
    movePin(p)
    setRecenterToken((t) => t + 1)
  }

  const lookupCep = async () => {
    if (!form?.zipCode || !isValidCep(form.zipCode)) return setError("Informe um CEP válido (8 dígitos)")
    setError("")
    setBusy("cep")
    try {
      const r = await adminFetch<{ address: string; neighborhood: string; city: string; state: string; latitude: number | null; longitude: number | null }>(
        `/api/company/geo/cep?cep=${encodeURIComponent(form.zipCode)}`,
      )
      setForm((f) => (f ? { ...f, address: f.address || r.address, neighborhood: r.neighborhood, city: r.city, state: r.state } : f))
      if (r.latitude !== null && r.longitude !== null) {
        recenter({ latitude: r.latitude, longitude: r.longitude })
        setInfo("Endereço encontrado — arraste o pin até o ponto exato do estabelecimento.")
      }
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao buscar o CEP")
    } finally {
      setBusy("")
    }
  }

  const geocode = async () => {
    if (!form) return
    const query = [form.address, form.neighborhood, form.city, form.state, "Brasil"].filter(Boolean).join(", ")
    setError("")
    setBusy("geocode")
    try {
      const r = await adminFetch<LatLng>(`/api/company/geo/geocode?q=${encodeURIComponent(query)}`)
      recenter(r)
      setInfo("Endereço localizado — arraste o pin até o ponto exato do estabelecimento.")
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao localizar o endereço")
    } finally {
      setBusy("")
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError("Seu navegador não permite obter a localização")
    setError("")
    setBusy("gps")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        recenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setInfo("Pin posicionado na sua localização atual — ajuste se precisar.")
        setBusy("")
      },
      () => {
        setError("Não foi possível obter sua localização — autorize o acesso ou posicione o pin manualmente.")
        setBusy("")
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const save = async () => {
    if (!form) return
    setError("")
    if (!position) return setError("Posicione o pin no mapa para salvar a localização exata")
    setBusy("save")
    try {
      const result = await adminFetch<Location>("/api/company/location", {
        method: "PATCH",
        body: JSON.stringify({ ...form, latitude: position.latitude, longitude: position.longitude }),
      })
      setForm(result)
      setSaved(true)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar a localização")
    } finally {
      setBusy("")
    }
  }

  if (!form) return <LoadingState />

  return (
    <AdminCard title="Localização e Contato do Estabelecimento" icon={MapPin}>
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Informe o endereço e arraste o pin até o ponto exato. Essa posição é usada na rota que o cliente indicado recebe no voucher, no mapa dos parceiros e na validação do ponto digital.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && !error && <p className="text-sm text-blue-700">{info}</p>}
        {saved && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Localização salva com sucesso.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">CEP</Label>
            <div className="flex gap-2">
              <Input value={form.zipCode ?? ""} onChange={(e) => update("zipCode", formatCep(e.target.value))} placeholder="00000-000" inputMode="numeric" />
              <Button type="button" variant="outline" onClick={lookupCep} disabled={busy !== ""} className="min-h-11 flex-shrink-0" aria-label="Buscar CEP">
                {busy === "cep" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-4">
            <Label className="text-xs">Endereço (rua e número)</Label>
            <Input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} placeholder="Rua, número" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Bairro</Label>
            <Input value={form.neighborhood ?? ""} onChange={(e) => update("neighborhood", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs">UF</Label>
            <Input value={form.state ?? ""} onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Telefone / WhatsApp oficial</Label>
            <Input value={form.phone ?? ""} onChange={(e) => update("phone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
            <p className="text-[11px] text-gray-400">Aparece no voucher do cliente (ligar/reservar).</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={geocode} disabled={busy !== ""} className="min-h-11">
            {busy === "geocode" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />} Localizar endereço no mapa
          </Button>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={busy !== ""} className="min-h-11">
            {busy === "gps" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <LocateFixed className="h-4 w-4 mr-1.5" />} Usar minha localização atual
          </Button>
        </div>

        <div className="h-72 md:h-96 rounded-2xl overflow-hidden border border-gray-200 touch-pan-y">
          <LocationMap position={position} onChange={movePin} recenterToken={recenterToken} />
        </div>
        <p className="text-xs text-gray-500">
          {position ? (
            <>
              Pin em <strong className="text-[#3E2415]">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</strong> — arraste o pin ou toque no mapa para ajustar.
            </>
          ) : (
            "Nenhum ponto definido — localize o endereço ou toque no mapa para posicionar o pin."
          )}
        </p>

        <Button type="button" onClick={save} disabled={busy !== ""} className="min-h-11 w-full sm:w-auto bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
          {busy === "save" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Salvar localização
        </Button>
      </div>
    </AdminCard>
  )
}
