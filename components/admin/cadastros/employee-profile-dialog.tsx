"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Eye, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { LoadingState } from "@/components/admin/admin-ui"
import { AvatarUpload } from "@/components/admin/avatar-upload"

type EmployeeDocField = "cpfDocUrl" | "rgDocUrl" | "proofOfResidenceUrl"

const DOCUMENT_FIELDS: { field: EmployeeDocField; label: string; icon: typeof FileText }[] = [
  { field: "cpfDocUrl", label: "Documento do CPF", icon: FileText },
  { field: "rgDocUrl", label: "Documento do RG/CNH", icon: FileText },
  { field: "proofOfResidenceUrl", label: "Comprovante de residência", icon: FileText },
]

type EmployeeProfile = {
  fullName: string | null
  nickname: string | null
  cpf: string | null
  rg: string | null
  rgIssuer: string | null
  birthDate: string | null
  gender: string | null
  maritalStatus: string | null
  voterCard: string | null
  militaryCertificate: string | null
  cnh: string | null
  cnhCategory: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  personalPhone: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  bankName: string | null
  accountType: string | null
  agency: string | null
  accountNumber: string | null
  pixKey: string | null
  cpfDocUrl: string | null
  rgDocUrl: string | null
  proofOfResidenceUrl: string | null
  photoUrl: string | null
  isProfileComplete: boolean
}

const FIELD = (
  key: keyof EmployeeProfile,
  value: string,
  onChange: (v: string) => void,
  label: string,
  type = "text",
) => (
  <div className="space-y-2" key={key}>
    <Label>{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
)

export function EmployeeProfileDialog({
  userId,
  userName,
  onClose,
}: {
  userId: string
  userName: string
  onClose: () => void
}) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<EmployeeDocField | null>(null)
  const [viewingField, setViewingField] = useState<EmployeeDocField | null>(null)
  const [uploadError, setUploadError] = useState("")
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    adminFetch<EmployeeProfile>(`/api/admin/users/${userId}/profile`)
      .then((data) => {
        setProfile(data)
        const initial: Record<string, string> = {}
        for (const [key, value] of Object.entries(data)) {
          if (key === "isProfileComplete") continue
          if (key === "birthDate") {
            initial[key] = value ? String(value).slice(0, 10) : ""
            continue
          }
          initial[key] = (value as string | null) ?? ""
        }
        setForm(initial)
      })
      .catch((e) => setError(e instanceof AdminApiError ? e.message : "Erro ao carregar perfil"))
      .finally(() => setIsLoading(false))
  }, [userId])

  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setIsSaving(true)
    setError("")
    try {
      await adminFetch(`/api/admin/users/${userId}/profile`, { method: "PATCH", body: JSON.stringify(form) })
      onClose()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpload = async (field: EmployeeDocField, file: File | undefined) => {
    if (!file) return
    setUploadError("")
    setUploadingField(field)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("userId", userId)
      body.append("field", field)

      // O servidor salva `path` no EmployeeProfile — a URL assinada é gerada
      // sob demanda depois, ao clicar em "Visualizar Documento" (evita abrir
      // popup de forma assíncrona, que a maioria dos browsers bloqueia).
      const { path } = await adminFetch<{ path: string }>("/api/admin/employees/upload", { method: "POST", body })
      setProfile((p) => (p ? { ...p, [field]: path } : p))
    } catch (e) {
      setUploadError(e instanceof AdminApiError ? e.message : "Erro ao enviar arquivo")
    } finally {
      setUploadingField(null)
    }
  }

  const handleView = async (field: EmployeeDocField) => {
    setUploadError("")
    setViewingField(field)
    try {
      const params = new URLSearchParams({ userId, field })
      const { url } = await adminFetch<{ url: string }>(`/api/admin/employees/document-url?${params}`)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      setUploadError(e instanceof AdminApiError ? e.message : "Erro ao gerar link do documento")
    } finally {
      setViewingField(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Perfil de {userName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : (
          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-5 pt-4">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <AvatarUpload
                label="Foto de perfil"
                ownerType="employee"
                ownerId={userId}
                field="photoUrl"
                value={profile?.photoUrl ?? null}
                onUploaded={(url) => setProfile((p) => (p ? { ...p, photoUrl: url } : p))}
                shape="circle"
              />

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Dados pessoais & documentos</p>
                <div className="grid grid-cols-2 gap-3">
                  {FIELD("fullName", form.fullName ?? "", set("fullName"), "Nome completo")}
                  {FIELD("nickname", form.nickname ?? "", set("nickname"), "Apelido")}
                  {FIELD("cpf", form.cpf ?? "", set("cpf"), "CPF")}
                  {FIELD("rg", form.rg ?? "", set("rg"), "RG")}
                  {FIELD("rgIssuer", form.rgIssuer ?? "", set("rgIssuer"), "Órgão emissor")}
                  {FIELD("birthDate", form.birthDate ?? "", set("birthDate"), "Data de nascimento", "date")}
                  {FIELD("gender", form.gender ?? "", set("gender"), "Gênero")}
                  {FIELD("maritalStatus", form.maritalStatus ?? "", set("maritalStatus"), "Estado civil")}
                  {FIELD("voterCard", form.voterCard ?? "", set("voterCard"), "Título de eleitor")}
                  {FIELD("militaryCertificate", form.militaryCertificate ?? "", set("militaryCertificate"), "Certificado militar")}
                  {FIELD("cnh", form.cnh ?? "", set("cnh"), "CNH")}
                  {FIELD("cnhCategory", form.cnhCategory ?? "", set("cnhCategory"), "Categoria CNH")}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Endereço & contato</p>
                <div className="grid grid-cols-2 gap-3">
                  {FIELD("street", form.street ?? "", set("street"), "Rua")}
                  {FIELD("number", form.number ?? "", set("number"), "Número")}
                  {FIELD("neighborhood", form.neighborhood ?? "", set("neighborhood"), "Bairro")}
                  {FIELD("city", form.city ?? "", set("city"), "Cidade")}
                  {FIELD("state", form.state ?? "", set("state"), "UF")}
                  {FIELD("zipCode", form.zipCode ?? "", set("zipCode"), "CEP")}
                  {FIELD("personalPhone", form.personalPhone ?? "", set("personalPhone"), "Telefone pessoal")}
                  {FIELD("emergencyContactName", form.emergencyContactName ?? "", set("emergencyContactName"), "Contato de emergência")}
                  {FIELD("emergencyContactPhone", form.emergencyContactPhone ?? "", set("emergencyContactPhone"), "Telefone de emergência")}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Dados bancários</p>
                <div className="grid grid-cols-2 gap-3">
                  {FIELD("bankName", form.bankName ?? "", set("bankName"), "Banco")}
                  {FIELD("accountType", form.accountType ?? "", set("accountType"), "Tipo de conta")}
                  {FIELD("agency", form.agency ?? "", set("agency"), "Agência")}
                  {FIELD("accountNumber", form.accountNumber ?? "", set("accountNumber"), "Conta")}
                  {FIELD("pixKey", form.pixKey ?? "", set("pixKey"), "Chave PIX")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documentos" className="pt-4">
              {uploadError && <p className="text-sm text-red-600 mb-3">{uploadError}</p>}
              <div className="space-y-2">
                {DOCUMENT_FIELDS.map(({ field, label, icon: Icon }) => {
                  const hasFile = Boolean(profile?.[field])
                  const isUploading = uploadingField === field
                  const isViewing = viewingField === field

                  return (
                    <div key={field} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-[#3E2415]">{label}</p>
                          <span className="text-xs text-gray-400">
                            {hasFile ? "Documento anexado" : "Nenhum arquivo enviado"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasFile && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isViewing}
                            onClick={() => handleView(field)}
                            title="Gera um link temporário (60 min) e abre em nova aba"
                          >
                            {isViewing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-1.5" />
                                Visualizar Documento
                              </>
                            )}
                          </Button>
                        )}

                        <input
                          ref={(el) => {
                            fileInputRefs.current[field] = el
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleUpload(field, e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[field]?.click()}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1.5" />
                              {hasFile ? "Trocar" : "Enviar"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
