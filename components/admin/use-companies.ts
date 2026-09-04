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
  expiresAt: string | null
}

export type AdminCompany = {
  id: string
  name: string
  slug: string
  status: "ACTIVE" | "INACTIVE"
  createdAt: string
  license: AdminLicense | null
  _count?: { users: number; units: number; programs: number; promotions: number }

  tradeName: string | null
  corporateName: string | null
  cnpj: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  latitude: number | null
  longitude: number | null
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
