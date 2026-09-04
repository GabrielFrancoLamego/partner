const EARTH_RADIUS_METERS = 6371000

/** Distância em metros entre duas coordenadas (fórmula de Haversine). */
export function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

export type GeofenceCheck = { allowed: boolean; distanceMeters: number | null; reason?: string }

/**
 * Valida a batida de ponto contra o raio configurado da empresa
 * (Company.latitude/longitude/geofenceRadiusMeters). Empresas sem
 * coordenadas cadastradas ainda liberam a batida (geofence opcional até o
 * Admin configurar o endereço em /admin/cadastros).
 */
export function checkGeofence(
  company: { latitude: number | null; longitude: number | null; geofenceRadiusMeters: number },
  latitude: number,
  longitude: number,
): GeofenceCheck {
  if (company.latitude === null || company.longitude === null) {
    return { allowed: true, distanceMeters: null }
  }

  const distanceMeters = Math.round(distanceInMeters(company.latitude, company.longitude, latitude, longitude))
  const allowed = distanceMeters <= company.geofenceRadiusMeters

  return {
    allowed,
    distanceMeters,
    reason: allowed
      ? undefined
      : `Você está a ${distanceMeters}m da unidade — fora do raio permitido de ${company.geofenceRadiusMeters}m.`,
  }
}
