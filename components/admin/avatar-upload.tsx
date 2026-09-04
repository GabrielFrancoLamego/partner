"use client"

import { useRef, useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"

type OwnerType = "company" | "employee" | "partner"

export function AvatarUpload({
  label,
  ownerType,
  ownerId,
  field,
  value,
  onUploaded,
  shape = "square",
}: {
  label: string
  ownerType: OwnerType
  ownerId: string
  field: string
  value: string | null
  onUploaded: (url: string) => void
  shape?: "square" | "circle" | "wide"
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = async (file: File | undefined) => {
    if (!file) return
    setError("")
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("ownerType", ownerType)
      body.append("ownerId", ownerId)
      body.append("field", field)

      const { url } = await adminFetch<{ url: string }>("/api/admin/uploads/avatar", { method: "POST", body })
      onUploaded(url)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao enviar imagem")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const frameClass =
    shape === "circle"
      ? "w-16 h-16 rounded-full"
      : shape === "wide"
        ? "w-28 h-16 rounded-lg"
        : "w-16 h-16 rounded-lg"

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`${frameClass} bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 flex-shrink-0`}
        >
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <Upload className="h-5 w-5 text-gray-300" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleChange(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : value ? "Trocar" : "Enviar"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
