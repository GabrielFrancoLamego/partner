"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"

export type AdminLicense = {
  id: string
  plan: string
  status: string
  maxEmployees: number
  maxPartners: number
  billingCycle: string
  isExempt: boolean
  exemptionMonths: number | null
  exemptionExpiresAt: string | null
  billingDay: number | null
  expiresAt: string | null
}

export type AdminCompanyStatus = "ACTIVE" | "INACTIVE" | "OVERDUE" | "BLOCKED" | "ARCHIVED"

export type AdminCompany = {
  id: string
  name: string
  slug: string
  status: AdminCompanyStatus
  statusReason: string | null
  overdueSince: string | null
  isArchived: boolean
  createdAt: string
  license: AdminLicense | null
  _count?: { users: number; units: number; programs: number; promotions: number }

  tradeName: string | null
  corporateName: string | null
  cnpj: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  latitude: number | null
  longitude: number | null
  geofenceRadiusMeters: number
  shiftClosingDeadline: string
  operatingShift1Start: string | null
  operatingShift1End: string | null
  operatingShift2Start: string | null
  operatingShift2End: string | null
  phone: string | null
  email: string | null
  website: string | null
  socialLinks: { instagram?: string; facebook?: string; linkedin?: string } | null
  shortDescription: string | null
  profilePictureUrl: string | null
  coverPictureUrl: string | null
  logoWithLabelUrl: string | null
}

export function useCompanies() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    return adminFetch<AdminCompany[]>("/api/admin/companies")
      .then(setCompanies)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { companies, isLoading, reload }
}
