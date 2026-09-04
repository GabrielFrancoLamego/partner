"use client"

export class AdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * fetch wrapper para app/admin/** — trata erro do formato `{ error }` das
 * rotas /api/admin/*. Quando `body` é FormData (upload de arquivo), não
 * força Content-Type: o browser precisa definir o boundary do multipart
 * sozinho.
 */
export async function adminFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData
  const response = await fetch(path, {
    ...options,
    headers: isFormData ? options?.headers : { "Content-Type": "application/json", ...options?.headers },
  })

  const isJson = response.headers.get("content-type")?.includes("application/json")
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    throw new AdminApiError(data?.error ?? `Erro ${response.status}`, response.status)
  }

  return data as T
}
