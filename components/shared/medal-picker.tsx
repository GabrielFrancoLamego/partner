"use client"

import { Medal, Gem, Upload, Loader2 } from "lucide-react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type MedalIconKey = "GOLD" | "SILVER" | "BRONZE" | "DIAMOND" | "CUSTOM"

const SYSTEM_MEDALS: { key: Exclude<MedalIconKey, "CUSTOM">; label: string; colorHex: string }[] = [
  { key: "GOLD", label: "Ouro", colorHex: "#EAB308" },
  { key: "SILVER", label: "Prata", colorHex: "#9CA3AF" },
  { key: "BRONZE", label: "Bronze", colorHex: "#B45309" },
  { key: "DIAMOND", label: "Diamante", colorHex: "#38BDF8" },
]

/** Ícone de uma medalha do sistema — usado tanto no seletor quanto onde o nível é exibido (timeline, badges). */
export function MedalGlyph({ medalIcon, className }: { medalIcon: Exclude<MedalIconKey, "CUSTOM">; className?: string }) {
  return medalIcon === "DIAMOND" ? <Gem className={className} /> : <Medal className={className} />
}

/**
 * Seletor de medalha de um nível — 4 presets do sistema (Ouro/Prata/Bronze/
 * Diamante) ou upload de ícone personalizado. Cor real do badge continua
 * sendo `badgeColorHex` (paleta do nível); aqui só escolhe o glifo/imagem.
 */
export function MedalPicker({
  medalIcon,
  imageUrl,
  badgeColorHex,
  onChange,
  onImageUploaded,
  uploadEndpoint,
  uploadKind,
}: {
  medalIcon: MedalIconKey
  imageUrl: string | null
  badgeColorHex: string
  onChange: (medalIcon: MedalIconKey) => void
  onImageUploaded: (url: string | null) => void
  uploadEndpoint: string
  uploadKind: string
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError("")
    if (file.size > 2 * 1024 * 1024) {
      setError("Arquivo excede 2MB")
      return
    }
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append("kind", uploadKind)
      body.append("file", file)
      const response = await fetch(uploadEndpoint, { method: "POST", body })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "Erro ao enviar arquivo")
      onChange("CUSTOM")
      onImageUploaded(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar arquivo")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#3E2415]">Ícone de Medalha</label>
      <div className="flex flex-wrap items-center gap-2">
        {SYSTEM_MEDALS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              onChange(m.key)
              onImageUploaded(null)
            }}
            className={cn(
              "w-11 h-11 rounded-lg flex items-center justify-center border-2 transition-all",
              medalIcon === m.key && !imageUrl ? "border-[#F58220] scale-105" : "border-transparent",
            )}
            style={{ backgroundColor: m.colorHex }}
            title={m.label}
          >
            <MedalGlyph medalIcon={m.key} className="h-5 w-5 text-white" />
          </button>
        ))}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "w-11 h-11 rounded-lg flex items-center justify-center border-2 overflow-hidden bg-gray-50",
            medalIcon === "CUSTOM" && imageUrl ? "border-[#F58220] scale-105" : "border-dashed border-gray-300",
          )}
          title="Ícone personalizado"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : imageUrl ? (
            <img src={imageUrl} alt="Ícone personalizado" className="w-full h-full object-cover" />
          ) : (
            <Upload className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Tamanho recomendado: 512x512px | Formato: PNG/SVG | Peso máximo: 2MB
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-400">Pré-visualização com a cor do nível:</span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ backgroundColor: badgeColorHex }}>
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <MedalGlyph medalIcon={medalIcon === "CUSTOM" ? "GOLD" : medalIcon} className="h-4 w-4 text-white" />
          )}
        </span>
      </div>
    </div>
  )
}
