"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useMemo, useRef } from "react"
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import L from "leaflet"

const markerIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export type LatLng = { latitude: number; longitude: number }

/** Recentraliza o mapa quando a posição muda por fora (busca de endereço, GPS) — arrastar o pin não recentraliza. */
function Recenter({ position, zoom, token }: { position: LatLng | null; zoom: number; token: number }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  return null
}

function ClickToMove({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    },
  })
  return null
}

/**
 * Mapa interativo do estabelecimento: o gestor arrasta o pin (ou toca no mapa)
 * até o ponto exato e a posição vira latitude/longitude. `recenterToken` muda
 * quando a posição foi alterada por fora e o mapa deve ir até ela.
 */
export default function LocationMap({ position, onChange, recenterToken }: { position: LatLng | null; onChange: (p: LatLng) => void; recenterToken: number }) {
  const markerRef = useRef<L.Marker | null>(null)
  const center: [number, number] = position ? [position.latitude, position.longitude] : [-14.235, -51.9253] // Brasil
  const zoom = position ? 17 : 4

  const handlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker) {
          const { lat, lng } = marker.getLatLng()
          onChange({ latitude: lat, longitude: lng })
        }
      },
    }),
    [onChange],
  )

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToMove onChange={onChange} />
      <Recenter position={position} zoom={17} token={recenterToken} />
      {position && <Marker draggable position={[position.latitude, position.longitude]} icon={markerIcon} eventHandlers={handlers} ref={markerRef} />}
    </MapContainer>
  )
}
