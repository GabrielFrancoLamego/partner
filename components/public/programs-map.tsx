"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import { ExternalLink, Tag } from "lucide-react"

// Fix do ícone padrão do Leaflet quebrado pelo bundling do Next — usa os
// mesmos assets via CDN em vez dos paths relativos que o webpack não resolve.
const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type CompanyPin = {
  id: string
  name: string
  slug: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  latitude: number
  longitude: number
  profilePictureUrl: string | null
  coverPictureUrl: string | null
  programs: {
    id: string
    name: string
    description: string
    commissionType: "FIXED" | "VARIABLE"
    commissionValue: string
    commissionFormat: "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"
    productUnitLabel: string | null
  }[]
  _count: { promotions: number }
}

function formatCommission(program: CompanyPin["programs"][number]) {
  if (program.commissionFormat === "PERCENTAGE") return `${program.commissionValue}%`
  if (program.commissionFormat === "PRODUCT_UNIT") return `${program.commissionValue}x ${program.productUnitLabel ?? "unidade"}`
  return `R$ ${program.commissionValue}`
}

export function ProgramsMap({ ctaHref }: { ctaHref: (companySlug: string) => string }) {
  const [companies, setCompanies] = useState<CompanyPin[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/public/programs-map")
      .then((r) => r.json())
      .then(setCompanies)
      .finally(() => setIsLoading(false))
  }, [])

  const center: [number, number] =
    companies.length > 0 ? [companies[0].latitude, companies[0].longitude] : [-3.8535, -40.5128] // Jericoacoara como fallback

  if (isLoading) {
    return <div className="h-[70vh] flex items-center justify-center bg-gray-50 rounded-2xl text-sm text-gray-400">Carregando mapa...</div>
  }

  return (
    <div className="h-[70vh] rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {companies.map((company) => (
          <Marker key={company.id} position={[company.latitude, company.longitude]} icon={markerIcon}>
            <Popup minWidth={240}>
              <div className="space-y-2">
                {company.profilePictureUrl && (
                  <img src={company.profilePictureUrl} alt={company.name} className="w-full h-20 object-cover rounded-lg" />
                )}
                <p className="font-bold text-sm text-[#3E2415]">{company.name}</p>
                <p className="text-xs text-gray-500">
                  {[company.address, company.neighborhood, company.city, company.state].filter(Boolean).join(", ")}
                </p>
                {company.programs.map((program) => (
                  <div key={program.id} className="text-xs bg-orange-50 rounded-lg p-2">
                    <p className="font-medium text-orange-800">{program.name}</p>
                    <p className="text-orange-700">Comissão: {formatCommission(program)}</p>
                  </div>
                ))}
                {company._count.promotions > 0 && (
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {company._count.promotions} promoção(ões) ativa(s)
                  </p>
                )}
                <a
                  href={ctaHref(company.slug)}
                  className="flex items-center justify-center gap-1 text-xs font-medium text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg py-1.5 mt-1"
                >
                  Aderir ao Programa <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {companies.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">Nenhuma empresa com programa ativo e localização cadastrada ainda.</p>
      )}
    </div>
  )
}
