"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Lock, Unlock, Trash2, Send, Search, Link2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { adminFetch, AdminApiError } from "@/lib/admin-api-client"
import { useCompanies, type AdminCompany } from "@/components/admin/use-companies"
import { usePlans } from "@/components/admin/use-plans"
import { StatusBadge, LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { AvatarUpload } from "@/components/admin/avatar-upload"
import { ReasonDialog } from "@/components/admin/reason-dialog"
import { TableDesktop, MobileCardList, MobileCard, MobileCardAction } from "@/components/admin/mobile-card"
import {
  formatCep,
  formatCnpj,
  formatPhone,
  isValidCep,
  isValidCnpj,
  isValidEmail,
  isValidPhone,
  onlyDigits,
} from "@/lib/validators"

const LICENSE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  TRIAL: "Trial",
  SUSPENDED: "Suspensa",
  EXPIRED: "Expirada",
  CANCELED: "Cancelada",
}

/** Mesma regra usada no dashboard (widget de Distribuição por Planos) para marcar uma licença como inadimplente. */
function isOverdue(license: AdminCompany["license"]): boolean {
  if (!license) return false
  if (license.status === "SUSPENDED") return true
  if (license.status === "ACTIVE" && license.expiresAt && new Date(license.expiresAt) < new Date()) return true
  return false
}

export function CompaniesTab({
  initialPlanFilter = null,
  initialConditionFilter = null,
}: {
  initialPlanFilter?: string | null
  initialConditionFilter?: "active" | "overdue" | null
}) {
  const { companies, isLoading, reload } = useCompanies()
  const { plans } = usePlans()
  const planLabels: Record<string, string> = Object.fromEntries(plans.map((p) => [p.id, p.label]))
  const [editing, setEditing] = useState<AdminCompany | "new" | null>(null)
  const [blocking, setBlocking] = useState<AdminCompany | null>(null)
  const [inviteLink, setInviteLink] = useState<{ link: string; email: string } | null>(null)
  const [planFilter, setPlanFilter] = useState(initialPlanFilter)
  const [conditionFilter, setConditionFilter] = useState(initialConditionFilter)

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      if (planFilter && company.license?.plan !== planFilter) return false
      if (conditionFilter === "active" && company.license?.status !== "ACTIVE") return false
      if (conditionFilter === "overdue" && !isOverdue(company.license)) return false
      return true
    })
  }, [companies, planFilter, conditionFilter])

  const hasFilter = Boolean(planFilter || conditionFilter)

  const handleConfirmToggleStatus = async (company: AdminCompany, reason: string) => {
    await adminFetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE", blockReason: reason }),
    }).catch((e) => alert(e instanceof AdminApiError ? e.message : "Erro ao atualizar"))
    setBlocking(null)
    reload()
  }

  const handleDelete = async (company: AdminCompany) => {
    if (!confirm(`Excluir a empresa "${company.name}"? Isso falhará se houver dados vinculados.`)) return
    await adminFetch(`/api/admin/companies/${company.id}`, { method: "DELETE" }).catch((e) =>
      alert(e instanceof AdminApiError ? e.message : "Erro ao excluir"),
    )
    reload()
  }

  const handleResendInvite = async (company: AdminCompany) => {
    try {
      const { inviteLink: link, masterEmail } = await adminFetch<{ inviteLink: string; masterEmail: string }>(
        `/api/admin/companies/${company.id}/resend-invite`,
        { method: "POST" },
      )
      setInviteLink({ link, email: masterEmail })
    } catch (e) {
      alert(e instanceof AdminApiError ? e.message : "Erro ao gerar link")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {hasFilter ? (
          <div className="flex items-center gap-2 text-xs bg-orange-50 text-orange-800 rounded-lg px-3 py-2 w-fit">
            <span>
              Filtrando: {planFilter ? planLabels[planFilter] ?? planFilter : "Todos os planos"}
              {conditionFilter === "active" ? " · Ativas" : conditionFilter === "overdue" ? " · Inadimplentes" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setPlanFilter(null)
                setConditionFilter(null)
              }}
              className="flex items-center gap-0.5 font-medium underline underline-offset-2"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          </div>
        ) : (
          <div />
        )}
        <Button
          onClick={() => setEditing("new")}
          className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md self-end sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filteredCompanies.length === 0 ? (
        <EmptyState message={hasFilter ? "Nenhuma empresa nessa condição." : "Nenhuma empresa cadastrada ainda."} />
      ) : (
        <>
          <MobileCardList>
            {filteredCompanies.map((company) => (
              <MobileCard
                key={company.id}
                title={company.name}
                subtitle={company.slug}
                badges={<StatusBadge status={company.status} />}
                fields={[
                  { label: "Usuários", value: company._count?.users ?? 0 },
                  {
                    label: "Licença",
                    value: company.license ? (
                      <span className="flex items-center gap-1">
                        {planLabels[company.license.plan] ?? company.license.plan}
                        {isOverdue(company.license) && <span className="text-red-600">· inadimplente</span>}
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                ]}
                actions={
                  <>
                    <MobileCardAction
                      icon={Link2}
                      label="Link público"
                      onClick={() => {
                        const url = `${window.location.origin}/join/company/${company.slug}`
                        navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
                      }}
                    />
                    <MobileCardAction icon={Send} label="Reenviar convite" onClick={() => handleResendInvite(company)} />
                    <MobileCardAction icon={Pencil} label="Editar" onClick={() => setEditing(company)} />
                    <MobileCardAction
                      icon={company.status === "ACTIVE" ? Lock : Unlock}
                      label={company.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
                      onClick={() => setBlocking(company)}
                    />
                    <MobileCardAction icon={Trash2} label="Excluir" tone="danger" onClick={() => handleDelete(company)} />
                  </>
                }
              />
            ))}
          </MobileCardList>

          <TableDesktop>
          <table className="w-full text-sm min-w-[720px]">
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
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#3E2415] whitespace-nowrap">{company.name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{company.slug}</td>
                  <td className="px-4 py-3 text-gray-600">{company._count?.users ?? 0}</td>
                  <td className="px-4 py-3">
                    {company.license ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-xs font-medium text-[#3E2415]">
                          {planLabels[company.license.plan] ?? company.license.plan}
                        </span>
                        <StatusBadge status={company.license.status} />
                        {company.license.isExempt && <span className="text-[10px] text-gray-400">isenta</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const url = `${window.location.origin}/join/company/${company.slug}`
                          navigator.clipboard.writeText(url).then(() => alert("Link copiado: " + url))
                        }}
                        title="Copiar link público de auto-cadastro"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResendInvite(company)}
                        title="Reenviar convite/acesso ao Master"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(company)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setBlocking(company)}
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
          </TableDesktop>
        </>
      )}

      {editing && (
        <CompanyDialog
          company={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(invite) => {
            setEditing(null)
            reload()
            if (invite) setInviteLink(invite)
          }}
        />
      )}

      {blocking && (
        <ReasonDialog
          title={blocking.status === "ACTIVE" ? `Bloquear ${blocking.name}` : `Desbloquear ${blocking.name}`}
          description="Esta ação é registrada na trilha de auditoria."
          confirmLabel={blocking.status === "ACTIVE" ? "Bloquear" : "Desbloquear"}
          destructive={blocking.status === "ACTIVE"}
          onConfirm={(reason) => handleConfirmToggleStatus(blocking, reason)}
          onClose={() => setBlocking(null)}
        />
      )}

      {inviteLink && (
        <Dialog open onOpenChange={() => setInviteLink(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link de ativação do Master</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-2">
              Ambiente local não envia email — copie e envie este link manualmente para <b>{inviteLink.email}</b>:
            </p>
            <Input readOnly value={inviteLink.link} onFocus={(e) => e.target.select()} />
            <DialogFooter>
              <Button onClick={() => setInviteLink(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
  onSaved: (invite?: { link: string; email: string }) => void
}) {
  const { plans } = usePlans()
  const [name, setName] = useState(company?.name ?? "")
  const [slug, setSlug] = useState(company?.slug ?? "")

  // Só usados na criação (Etapa 2 — cadastro simplificado)
  const [masterName, setMasterName] = useState("")
  const [masterEmail, setMasterEmail] = useState("")
  const [masterWhatsapp, setMasterWhatsapp] = useState("")
  const [plan, setPlan] = useState<string>("ENTERPRISE")
  const [isExemptNew, setIsExemptNew] = useState(false)
  const [billingDayNew, setBillingDayNew] = useState("")

  const [tradeName, setTradeName] = useState(company?.tradeName ?? "")
  const [corporateName, setCorporateName] = useState(company?.corporateName ?? "")
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "")
  const [address, setAddress] = useState(company?.address ?? "")
  const [neighborhood, setNeighborhood] = useState(company?.neighborhood ?? "")
  const [city, setCity] = useState(company?.city ?? "")
  const [state, setState] = useState(company?.state ?? "")
  const [zipCode, setZipCode] = useState(company?.zipCode ?? "")
  const [latitude, setLatitude] = useState(company?.latitude?.toString() ?? "")
  const [longitude, setLongitude] = useState(company?.longitude?.toString() ?? "")
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(String(company?.geofenceRadiusMeters ?? 150))
  const [shiftClosingDeadline, setShiftClosingDeadline] = useState(company?.shiftClosingDeadline ?? "22:00")
  const [shift1Start, setShift1Start] = useState(company?.operatingShift1Start ?? "")
  const [shift1End, setShift1End] = useState(company?.operatingShift1End ?? "")
  const [shift2Start, setShift2Start] = useState(company?.operatingShift2Start ?? "")
  const [shift2End, setShift2End] = useState(company?.operatingShift2End ?? "")
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
  const [editPlan, setEditPlan] = useState(company?.license?.plan ?? "ENTERPRISE")
  const [licenseStatus, setLicenseStatus] = useState(company?.license?.status ?? "ACTIVE")
  const [maxEmployees, setMaxEmployees] = useState(String(company?.license?.maxEmployees ?? 50))
  const [maxPartners, setMaxPartners] = useState(String(company?.license?.maxPartners ?? 500))
  const [billingCycle, setBillingCycle] = useState(company?.license?.billingCycle ?? "MONTHLY")
  const [expiresAt, setExpiresAt] = useState(company?.license?.expiresAt?.slice(0, 10) ?? "")
  const [isExempt, setIsExempt] = useState(company?.license?.isExempt ?? false)
  const [billingDay, setBillingDay] = useState(company?.license?.billingDay?.toString() ?? "")

  const [isLookingUpCep, setIsLookingUpCep] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cnpjError = cnpj && !isValidCnpj(cnpj) ? "CNPJ inválido" : ""
  const companyEmailError = companyEmail && !isValidEmail(companyEmail) ? "Email inválido" : ""
  const phoneError = phone && !isValidPhone(phone) ? "Telefone inválido" : ""
  const masterEmailError = masterEmail && !isValidEmail(masterEmail) ? "Email inválido" : ""
  const masterWhatsappError = masterWhatsapp && !isValidPhone(masterWhatsapp) ? "WhatsApp inválido" : ""

  const handleCepLookup = async () => {
    if (!isValidCep(zipCode)) {
      setError("Informe um CEP válido antes de buscar")
      return
    }
    setIsLookingUpCep(true)
    setError("")
    try {
      const result = await adminFetch<{
        address: string
        neighborhood: string
        city: string
        state: string
        latitude: number | null
        longitude: number | null
      }>(`/api/admin/geo/cep?cep=${onlyDigits(zipCode)}`)
      setAddress(result.address)
      setNeighborhood(result.neighborhood)
      setCity(result.city)
      setState(result.state)
      if (result.latitude !== null) setLatitude(String(result.latitude))
      if (result.longitude !== null) setLongitude(String(result.longitude))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Erro ao buscar CEP")
    } finally {
      setIsLookingUpCep(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!company) {
      if (masterEmailError || (masterWhatsapp && masterWhatsappError)) {
        setError(masterEmailError || masterWhatsappError)
        return
      }
    } else if (cnpjError || companyEmailError || phoneError) {
      setError(cnpjError || companyEmailError || phoneError)
      return
    }

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
            neighborhood,
            city,
            state,
            zipCode,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            geofenceRadiusMeters: Number(geofenceRadiusMeters) || 150,
            shiftClosingDeadline,
            operatingShift1Start: shift1Start || null,
            operatingShift1End: shift1End || null,
            operatingShift2Start: shift2Start || null,
            operatingShift2End: shift2End || null,
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
            plan: editPlan,
            status: licenseStatus,
            maxEmployees: Number(maxEmployees),
            maxPartners: Number(maxPartners),
            billingCycle,
            expiresAt: expiresAt || null,
            isExempt,
            billingDay: billingDay ? Number(billingDay) : null,
          }),
        })
        onSaved()
      } else {
        const result = await adminFetch<{ inviteLink: string; master: { email: string } }>("/api/admin/companies", {
          method: "POST",
          body: JSON.stringify({
            name,
            slug,
            masterName,
            masterEmail,
            masterWhatsapp: masterWhatsapp || undefined,
            plan,
            isExempt: isExemptNew,
            billingDay: billingDayNew ? Number(billingDayNew) : undefined,
          }),
        })
        onSaved({ link: result.inviteLink, email: result.master.email })
      }
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

          {!company && (
            <div className="space-y-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Master da Empresa</p>
              <div className="space-y-2">
                <Label>Nome do Master</Label>
                <Input value={masterName} onChange={(e) => setMasterName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email do Master</Label>
                  <Input type="email" value={masterEmail} onChange={(e) => setMasterEmail(e.target.value)} required />
                  {masterEmailError && <p className="text-xs text-red-600">{masterEmailError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp do Master</Label>
                  <Input
                    value={masterWhatsapp}
                    onChange={(e) => setMasterWhatsapp(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                  {masterWhatsappError && <p className="text-xs text-red-600">{masterWhatsappError}</p>}
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2">Plano & Cobrança</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label} — {p.maxEmployees} colab. / {p.maxPartners} parc.
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Dia de cobrança</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={billingDayNew}
                    onChange={(e) => setBillingDayNew(e.target.value)}
                    placeholder="ex: 5"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={isExemptNew} onCheckedChange={(v) => setIsExemptNew(v === true)} />
                Isenta de pagamento (uso interno do grupo)
              </label>
            </div>
          )}

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
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                  />
                  {cnpjError && <p className="text-xs text-red-600">{cnpjError}</p>}
                </div>

                <div className="flex items-end gap-2">
                  <div className="space-y-2 flex-1">
                    <Label>CEP</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(formatCep(e.target.value))} placeholder="00000-000" />
                  </div>
                  <Button type="button" variant="outline" onClick={handleCepLookup} disabled={isLookingUpCep}>
                    <Search className="h-4 w-4 mr-1" />
                    {isLookingUpCep ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
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
                  Latitude/longitude definem o centro da unidade para validação de GPS no Ponto Digital da empresa —
                  preenchidas automaticamente ao buscar o CEP.
                </p>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Label>Horário-limite do fechamento diário</Label>
                  <Input type="time" value={shiftClosingDeadline} onChange={(e) => setShiftClosingDeadline(e.target.value)} className="w-40" />
                  <p className="text-xs text-gray-400">
                    Após esse horário, o fechamento de expediente pendente é sinalizado como PENDENTE_MASTER.
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <Label>Horário de funcionamento (até 2 turnos/dia)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Turno 1 — início</p>
                      <Input type="time" value={shift1Start} onChange={(e) => setShift1Start(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Turno 1 — fim</p>
                      <Input type="time" value={shift1End} onChange={(e) => setShift1End(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Turno 2 — início</p>
                      <Input type="time" value={shift2Start} onChange={(e) => setShift2Start(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Turno 2 — fim</p>
                      <Input type="time" value={shift2End} onChange={(e) => setShift2End(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Deixe em branco o Turno 2 se a empresa funcionar em turno único.</p>
                </div>
              </TabsContent>

              <TabsContent value="contato" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
                    {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
                    {companyEmailError && <p className="text-xs text-red-600">{companyEmailError}</p>}
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
                    <Select value={editPlan} onValueChange={setEditPlan}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
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
                        {Object.entries(LICENSE_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Dia de cobrança</Label>
                    <Input type="number" min={1} max={28} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 pt-6">
                    <Checkbox checked={isExempt} onCheckedChange={(v) => setIsExempt(v === true)} />
                    Isenta de pagamento
                  </label>
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
