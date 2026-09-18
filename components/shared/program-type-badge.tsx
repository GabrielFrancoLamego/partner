import { Users, Award } from "lucide-react"

/** Distinção visual instantânea entre os dois tipos de programa — usada em toda listagem/card de programas. */
export function ProgramTypeBadge({ type }: { type: "PARTNER" | "INTERNAL" }) {
  if (type === "PARTNER") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2.5 py-1">
        <Users className="h-3 w-3" />
        Programa de Parceiros
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-100 border border-green-200 rounded-full px-2.5 py-1">
      <Award className="h-3 w-3" />
      Programa Interno
    </span>
  )
}
