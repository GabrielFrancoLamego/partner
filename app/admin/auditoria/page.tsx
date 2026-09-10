"use client"

import { Fragment, useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminFetch } from "@/lib/admin-api-client"
import { useCompanies } from "@/components/admin/use-companies"
import { CompanyFilter } from "@/components/admin/admin-filters"
import { LoadingState, EmptyState } from "@/components/admin/admin-ui"
import { TableDesktop, MobileCardList, MobileCard } from "@/components/admin/mobile-card"

type AuditLog = {
  id: string
  action: string
  entity: string
  entityId: string | null
  details: unknown
  createdAt: string
  companyId: string | null
  user: { id: string; name: string; email: string; role: string }
}

const ACTIONS = ["CREATE", "UPDATE", "DELETE", "BLOCK", "UNBLOCK", "PIX_APPROVAL", "REASSIGN", "GRANT_BONUS", "APPROVE_REGISTRATION", "REJECT_REGISTRATION"]

export default function AdminAuditoriaPage() {
  const { companies } = useCompanies()
  const [companyId, setCompanyId] = useState("all")
  const [action, setAction] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    const params = new URLSearchParams({ companyId })
    if (action !== "all") params.set("action", action)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    adminFetch<AuditLog[]>(`/api/admin/audit-logs?${params}`)
      .then(setLogs)
      .finally(() => setIsLoading(false))
  }, [companyId, action, from, to])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[#3E2415]">Auditoria & Logs</h1>
        <p className="text-gray-600 mt-1 text-sm">Trilha completa de ações críticas na plataforma</p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-end">
        <CompanyFilter companies={companies} value={companyId} onChange={setCompanyId} />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full sm:w-52 bg-white">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-md border border-gray-100">
        {isLoading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <EmptyState message="Nenhum registro de auditoria encontrado para os filtros selecionados." />
        ) : (
          <>
            <TableDesktop>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Usuário</th>
                    <th className="px-4 py-3 font-medium">Ação</th>
                    <th className="px-4 py-3 font-medium">Entidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#3E2415]">{log.user.name}</p>
                          <p className="text-xs text-gray-400">{log.user.role}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {log.entity}
                          {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                        </td>
                      </tr>
                      {expanded === log.id && log.details != null && (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 bg-gray-50">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableDesktop>

            <MobileCardList>
              {logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="cursor-pointer"
                >
                  <MobileCard
                    title={log.user.name}
                    subtitle={`${log.user.role} · ${new Date(log.createdAt).toLocaleString("pt-BR")}`}
                    badges={
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {log.action}
                      </span>
                    }
                    fields={[
                      {
                        label: "Entidade",
                        value: `${log.entity}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}`,
                      },
                    ]}
                    actions={
                      expanded === log.id && log.details != null ? (
                        <pre className="w-full text-xs text-gray-600 whitespace-pre-wrap break-all">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : undefined
                    }
                  />
                </div>
              ))}
            </MobileCardList>
          </>
        )}
      </div>
    </div>
  )
}
