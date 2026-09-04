"use client"

import { useState } from "react"
import { Plus, Pencil, Lock, Unlock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies, type AdminCompany } from "@/components/admin/use-companies"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { AvatarUpload } from "@/components/admin/avatar-upload"

const PLAN_LABELS: Record<string, string> = { STANDARD: "Standard", PREMIUM: "Premium", ENTERPRISE: "Enterprise" }

export function CompaniesTab() {
  const { companies, isLoading, reload } = useCompanies()
  const [editing, setEditing] = useState<AdminCompany | "new" | null>(null)

  const handleToggleStatus = async (company: AdminCompany) => {
    await adminFetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao atualizar"))
    reload()
  }

  const handleDelete = async (company: AdminCompany) => {
    if (!confirm(`Excluir a empresa "${company.name}"? Isso falhará se houver dados vinculados.`)) return
    await adminFetch(`/api/admin/companies/${company.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : companies.length === 0 ? (
        <EmptyState message="Nenhuma empresa cadastrada ainda." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Usuários</th>
                <th className="px-4 py-3 font-medium">Licença</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415]">{company.name}</td>
                  <td className="px-4 py-3 text-gray-500">{company.slug}</td>
                  <td className="px-4 py-3 text-gray-600">{company._count?.users ?? 0}</td>
                  <td className="px-4 py-3">
                    {company.license ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[#3E2415]">
                          {PLAN_LABELS[company.license.plan] ?? company.license.plan}
                        </span>
                        <StatusBadge status={company.license.status} />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(company)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(company)}
                        title={company.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                      >
                        {company.status === "ACTIVE" ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(company)}
                        title="Excluir"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CompanyDialog
          company={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function CompanyDialog({
  company,
  onClose,
  onSaved,
}: {
  company: AdminCompany | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(company?.name ?? "")
  const [slug, setSlug] = useState(company?.slug ?? "")
  const [tradeName, setTradeName] = useState(company?.tradeName ?? "")
  const [corporateName, setCorporateName] = useState(company?.corporateName ?? "")
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "")
  const [address, setAddress] = useState(company?.address ?? "")
  const [city, setCity] = useState(company?.city ?? "")
  const [state, setState] = useState(company?.state ?? "")
  const [zipCode, setZipCode] = useState(company?.zipCode ?? "")
  const [latitude, setLatitude] = useState(company?.latitude?.toString() ?? "")
  const [longitude, setLongitude] = useState(company?.longitude?.toString() ?? "")
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(String(company?.geofenceRadiusMeters ?? 150))
  const [phone, setPhone] = useState(company?.phone ?? "")
  const [companyEmail, setCompanyEmail] = useState(company?.email ?? "")
  const [website, setWebsite] = useState(company?.website ?? "")
  const [shortDescription, setShortDescription] = useState(company?.shortDescription ?? "")
  const [profilePictureUrl, setProfilePictureUrl] = useState(company?.profilePictureUrl ?? "")
  const [coverPictureUrl, setCoverPictureUrl] = useState(company?.coverPictureUrl ?? "")
  const [logoWithLabelUrl, setLogoWithLabelUrl] = useState(company?.logoWithLabelUrl ?? "")
  const [instagram, setInstagram] = useState(company?.socialLinks?.instagram ?? "")
  const [facebook, setFacebook] = useState(company?.socialLinks?.facebook ?? "")
  const [linkedin, setLinkedin] = useState(company?.socialLinks?.linkedin ?? "")
  const [plan, setPlan] = useState(company?.license?.plan ?? "ENTERPRISE")
  const [licenseStatus, setLicenseStatus] = useState(company?.license?.status ?? "ACTIVE")
  const [maxEmployees, setMaxEmployees] = useState(String(company?.license?.maxEmployees ?? 50))
  const [maxPartners, setMaxPartners] = useState(String(company?.license?.maxPartners ?? 500))
  const [billingCycle, setBillingCycle] = useState(company?.license?.billingCycle ?? "MONTHLY")
  const [expiresAt, setExpiresAt] = useState(company?.license?.expiresAt?.slice(0, 10) ?? "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      if (company) {
        await adminFetch(`/api/admin/companies/${company.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            slug,
            tradeName,
            corporateName,
            cnpj: cnpj || null,
            address,
            city,
            state,
            zipCode,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            geofenceRadiusMeters: Number(geofenceRadiusMeters) || 150,
            phone,
            email: companyEmail,
            website,
            shortDescription,
            profilePictureUrl,
            coverPictureUrl,
            logoWithLabelUrl,
            socialLinks: { instagram, facebook, linkedin },
          }),
        })
        await adminFetch(`/api/admin/companies/${company.id}/license`, {
          method: "PATCH",
          body: JSON.stringify({
            plan,
            status: licenseStatus,
            maxEmployees: Number(maxEmployees),
            maxPartners: Number(maxPartners),
            billingCycle,
            expiresAt: expiresAt || null,
          }),
        })
      } else {
        await adminFetch("/api/admin/companies", { method: "POST", body: JSON.stringify({ name, slug }) })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao salvar")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nomad's Lagoa" required />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="nomads-lagoa" required />
          </div>

          {company && (
            <Tabs defaultValue="dados">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="contato">Contato & Mídia</TabsTrigger>
                <TabsTrigger value="licenca">Licença</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Razão Social</Label>
                    <Input value={corporateName} onChange={(e) => setCorporateName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição curta</Label>
                  <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-2.797500" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="-40.513700" />
                  </div>
                  <div className="space-y-2">
                    <Label>Raio do geofence (m)</Label>
                    <Input type="number" value={geofenceRadiusMeters} onChange={(e) => setGeofenceRadiusMeters(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Latitude/longitude definem o centro da unidade para validação de GPS no Ponto Digital da empresa.
                </p>
              </TabsContent>

              <TabsContent value="contato" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@perfil" />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook</Label>
                    <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn</Label>
                    <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                  </div>
                </div>
                {company && (
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                    <AvatarUpload
                      label="Foto de perfil"
                      ownerType="company"
                      ownerId={company.id}
                      field="profilePictureUrl"
                      value={profilePictureUrl || null}
                      onUploaded={setProfilePictureUrl}
                      shape="circle"
                    />
                    <AvatarUpload
                      label="Foto de capa"
                      ownerType="company"
                      ownerId={company.id}
                      field="coverPictureUrl"
                      value={coverPictureUrl || null}
                      onUploaded={setCoverPictureUrl}
                      shape="wide"
                    />
                    <AvatarUpload
                      label="Logo com rótulo"
                      ownerType="company"
                      ownerId={company.id}
                      field="logoWithLabelUrl"
                      value={logoWithLabelUrl || null}
                      onUploaded={setLogoWithLabelUrl}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="licenca" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select value={plan} onValueChange={setPlan}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard</SelectItem>
                        <SelectItem value="PREMIUM">Premium</SelectItem>
                        <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status da licença</Label>
                    <Select value={licenseStatus} onValueChange={setLicenseStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Ativa</SelectItem>
                        <SelectItem value="TRIAL">Trial</SelectItem>
                        <SelectItem value="SUSPENDED">Suspensa</SelectItem>
                        <SelectItem value="EXPIRED">Expirada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Limite de colaboradores</Label>
                    <Input type="number" value={maxEmployees} onChange={(e) => setMaxEmployees(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de parceiros</Label>
                    <Input type="number" value={maxPartners} onChange={(e) => setMaxPartners(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Ciclo de cobrança</Label>
                    <Select value={billingCycle} onValueChange={setBillingCycle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Mensal</SelectItem>
                        <SelectItem value="YEARLY">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Expira em</Label>
                    <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
