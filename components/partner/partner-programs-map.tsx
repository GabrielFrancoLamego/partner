"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import { Tag, Check } from "lucide-react"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { AdesaoGateDialog } from "./adesao-gate-dialog"

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type MembershipStatus = "ACTIVE" | "LEFT_BY_PARTNER" | "TERMINATED_INACTIVITY" | "PROGRAM_ENDED" | null

type ProgramPin = {
  id: string
  name: string
  description: string
  commissionType: "FIXED" | "VARIABLE" | "BOTH"
  commissionValue: string
  commissionFormat: "PERCENTAGE" | "FIXED_VALUE" | "PRODUCT_UNIT"
  fixedValue: string | null
  productUnitLabel: string | null
  status: "ACTIVE" | "PAUSED_FOR_NEW_MEMBERS" | "ARCHIVED"
  membershipStatus: MembershipStatus
}

type CompanyPin = {
  id: string
  name: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  latitude: number
  longitude: number
  profilePictureUrl: string | null
  programs: ProgramPin[]
  _count: { promotions: number }
}

function formatCommission(program: ProgramPin) {
  const base =
    program.commissionFormat === "PERCENTAGE"
      ? `${program.commissionValue}%`
      : program.commissionFormat === "PRODUCT_UNIT"
        ? `${program.commissionValue}x ${program.productUnitLabel ?? "unidade"}`
        : `R$ ${program.commissionValue}`
  return program.commissionType === "BOTH" && program.fixedValue ? `${base} + R$ ${program.fixedValue}` : base
}

/** Mapa interativo (/partner/mapa) — clicar num pino mostra foto, comissão e "Aderir ao Programa" direto no popup. */
export function PartnerProgramsMap() {
  const [companies, setCompanies] = useState<CompanyPin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [adesaoGateFor, setAdesaoGateFor] = useState<ProgramPin | null>(null)

  const reload = () => {
    setIsLoading(true)
    adminFetch<CompanyPin[]>("/api/partner/programs-map").then(setCompanies).finally(() => setIsLoading(false))
  }
  useEffect(reload, [])

  const handleJoin = async (program: ProgramPin) => {
    setJoiningId(program.id)
    try {
      await adminFetch(`/api/partner/programs/${program.id}/join`, { method: "POST" })
      reload()
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 428) {
        setAdesaoGateFor(program)
        return
      }
      alert(e instanceof AdminApiError ? e.message : "Erro ao aderir")
    } finally {
      setJoiningId(null)
    }
  }

  const center: [number, number] = companies.length > 0 ? [companies[0].latitude, companies[0].longitude] : [-2.7955, -40.5128]

  if (isLoading) {
    return <div className="h-[70vh] flex items-center justify-center bg-gray-50 rounded-2xl text-sm text-gray-400">Carregando mapa...</div>
  }

  return (
    <>
      <div className="h-[70vh] rounded-2xl overflow-hidden border border-gray-200">
        <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
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
                    <div key={program.id} className="text-xs bg-orange-50 rounded-lg p-2 space-y-1.5">
                      <p className="font-medium text-orange-800">{program.name}</p>
                      <p className="text-orange-700">Comissão: {formatCommission(program)}</p>
                      {program.membershipStatus === "ACTIVE" ? (
                        <p className="flex items-center gap-1 text-green-700 font-medium">
                          <Check className="h-3 w-3" /> Você já participa
                        </p>
                      ) : (
                        <button
                          onClick={() => handleJoin(program)}
                          disabled={joiningId === program.id || program.status !== "ACTIVE"}
                          className="w-full text-center text-xs font-medium text-white bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] rounded-lg py-1.5 disabled:opacity-50"
                        >
                          {program.status !== "ACTIVE" ? "Fechado p/ novas adesões" : joiningId === program.id ? "Aderindo..." : "Aderir ao Programa"}
                        </button>
                      )}
                    </div>
                  ))}
                  {company._count.promotions > 0 && (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <Tag className="h-3 w-3" /> {company._count.promotions} promoção(ões) ativa(s)
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {companies.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">Nenhuma empresa com programa ativo e localização cadastrada ainda.</p>
      )}
      {adesaoGateFor && (
        <AdesaoGateDialog
          onClose={() => setAdesaoGateFor(null)}
          onCompleted={() => {
            const program = adesaoGateFor
            setAdesaoGateFor(null)
            handleJoin(program)
          }}
        />
      )}
    </>
  )
}
