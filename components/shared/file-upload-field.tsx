"use client"

import { useRef, useState } from "react"
import { Upload, FileText, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Upload real (Supabase Storage via /api/{admin,company}/uploads) com
 * preview — substitui inputs de texto "URL da imagem/PDF" em Programas,
 * Programa Interno e Promoções. `kind` é repassado como está para a rota de
 * upload, que decide o bucket/pasta certos (ver lib/storage.ts).
 */
export function FileUploadField({
  label,
  hint,
  accept,
  currentUrl,
  uploadEndpoint,
  kind,
  onUploaded,
  variant = "image",
}: {
  label: string
  hint?: string
  accept: string
  currentUrl: string | null
  uploadEndpoint: string
  kind: string
  onUploaded: (url: string) => void
  variant?: "image" | "pdf"
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError("")
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("kind", kind)
      body.append("file", file)
      const response = await fetch(uploadEndpoint, { method: "POST", body })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Erro ao enviar arquivo")
      onUploaded(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar arquivo")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#3E2415]">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className="flex items-center gap-3">
        {variant === "image" && currentUrl && (
          <img src={currentUrl} alt="" className="w-24 h-14 object-cover rounded-lg border border-gray-200" />
        )}
        {variant === "pdf" && currentUrl && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#F58220] hover:underline"
          >
            <FileText className="h-4 w-4" /> Ver arquivo atual <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {currentUrl ? "Trocar" : "Enviar"}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
