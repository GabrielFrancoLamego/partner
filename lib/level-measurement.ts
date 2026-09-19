export type MeasurementUnit = "ALL_TIME" | "DAYS" | "MONTHS"

/** Chave do seletor estrito de período de mensuração de um nível/cargo (task: CRUD de níveis). */
export type MeasurementPreset = "ALL_TIME" | "MONTHLY" | "BIMONTHLY" | "SEMIANNUAL" | "ANNUAL"

export const MEASUREMENT_PRESET_LABELS: Record<MeasurementPreset, string> = {
  ALL_TIME: "Vitalício (nunca reavalia)",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
}

const PRESET_TO_MONTHS: Record<Exclude<MeasurementPreset, "ALL_TIME">, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  SEMIANNUAL: 6,
  ANNUAL: 12,
}

/** (unit, value) do schema -> chave do seletor estrito exibido na UI. */
export function toMeasurementPreset(unit: MeasurementUnit, value: number | null | undefined): MeasurementPreset {
  if (unit === "ALL_TIME" || !value) return "ALL_TIME"
  const found = (Object.entries(PRESET_TO_MONTHS) as [Exclude<MeasurementPreset, "ALL_TIME">, number][]).find(
    ([, months]) => months === value,
  )
  return found ? found[0] : "ANNUAL"
}

/** Chave do seletor estrito -> (unit, value) para gravar no schema. */
export function fromMeasurementPreset(preset: MeasurementPreset): { unit: MeasurementUnit; value: number } {
  if (preset === "ALL_TIME") return { unit: "ALL_TIME", value: 0 }
  return { unit: "MONTHS", value: PRESET_TO_MONTHS[preset] }
}
