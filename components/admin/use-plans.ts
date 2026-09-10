"use client"

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-api-client"
import { DEFAULT_PLAN_DEFINITIONS, PLAN_IDS, type PlanDefinition } from "@/lib/plans"

export function usePlans() {
  const [plans, setPlans] = useState<PlanDefinition[]>(PLAN_IDS.map((id) => DEFAULT_PLAN_DEFINITIONS[id]))
  const [isLoading, setIsLoading] = useState(true)

  const reload = () => {
    setIsLoading(true)
    return adminFetch<PlanDefinition[]>("/api/admin/plans")
      .then(setPlans)
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { plans, isLoading, reload }
}
