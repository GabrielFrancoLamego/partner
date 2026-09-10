import "server-only"
import { onlyDigits } from "./validators"

export type CepLookupResult = {
  address: string
  neighborhood: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
}

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

type NominatimResult = { lat: string; lon: string }[]

/**
 * Resolve um CEP para endereço (ViaCEP) e tenta geocodificar para lat/lng
 * (Nominatim/OpenStreetMap) — nenhum dos dois exige API key, adequados para o
 * volume de uso do cadastro de empresas do Admin. Se a geocodificação falhar
 * (fora do ar, endereço não localizado), retorna lat/lng nulos e o Admin
 * ajusta manualmente — mesma UX que já existia antes desta função.
 */
export async function lookupCep(cep: string): Promise<CepLookupResult | null> {
  const digits = onlyDigits(cep)
  if (digits.length !== 8) return null

  const viaCepResponse = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    headers: { Accept: "application/json" },
  }).catch(() => null)

  if (!viaCepResponse?.ok) return null
  const viaCep = (await viaCepResponse.json().catch(() => null)) as ViaCepResponse | null
  if (!viaCep || viaCep.erro) return null

  const address = viaCep.logradouro ?? ""
  const neighborhood = viaCep.bairro ?? ""
  const city = viaCep.localidade ?? ""
  const state = viaCep.uf ?? ""

  let latitude: number | null = null
  let longitude: number | null = null

  const query = [address, neighborhood, city, state, "Brasil"].filter(Boolean).join(", ")
  if (query) {
    const geocoded = await geocodeAddress(query)
    latitude = geocoded?.latitude ?? null
    longitude = geocoded?.longitude ?? null
  }

  return { address, neighborhood, city, state, latitude, longitude }
}

export async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    // Nominatim exige um User-Agent identificável — sem isso, o request é recusado.
    headers: { "User-Agent": "TribussPlatform/1.0 (admin-cadastro-empresas)" },
  }).catch(() => null)

  if (!response?.ok) return null
  const results = (await response.json().catch(() => null)) as NominatimResult | null
  if (!results || results.length === 0) return null

  const latitude = Number(results[0].lat)
  const longitude = Number(results[0].lon)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null
  return { latitude, longitude }
}
