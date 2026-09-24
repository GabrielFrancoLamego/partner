"use client"

import { useEffect } from "react"

/**
 * Registra public/sw.js no client. Silencioso em navegadores sem suporte
 * (ex: navegação in-app de redes sociais) — PWA é progressive enhancement,
 * nunca deve bloquear o carregamento normal do app.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return // evita cache agressivo atrapalhar o HMR do `next dev`

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Falha ao registrar o Service Worker", err)
    })
  }, [])

  return null
}
