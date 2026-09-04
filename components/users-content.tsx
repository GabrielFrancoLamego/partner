"use client"

import type React from "react"

import { useState } from "react"
import { Plus, Search, Eye, Shield, ShieldCheck, Crown, Filter, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type UserRole = "scanner" | "colaborador" | "admin" | "master"

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
  lastActive: string
  status: "active" | "inactive"
  activityLog: ActivityLog[]
}

interface ActivityLog {
  id: string
  action: string
  timestamp: string
  details: string
}

export function UsersContent() {
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "João Silva",
      email: "joao@nomadsjeri.com",
      role: "master",
      createdAt: "2024-01-15",
      lastActive: "2024-01-27 14:30",
      status: "active",
      activityLog: [
        {
          id: "1",
          action: "Login no sistema",
          timestamp: "2024-01-27 14:30",
          details: "Login realizado com sucesso",
        },
        {
          id: "2",
          action: "Aprovou pagamento de comissão",
          timestamp: "2024-01-27 14:25",
          details: "Comissão #1234 - R$ 450,00 para parceiro Maria Santos",
        },
        {
          id: "3",
          action: "Cadastrou novo usuário",
          timestamp: "2024-01-27 13:15",
          details: "Usuário Carlos Oliveira - Tipo: Administrativo",
        },
      ],
    },
    {
      id: "2",
      name: "Carlos Oliveira",
      email: "carlos@nomadsjeri.com",
      role: "admin",
      createdAt: "2024-01-20",
      lastActive: "2024-01-27 12:15",
      status: "active",
      activityLog: [
        {
          id: "1",
          action: "Registrou comissão",
          timestamp: "2024-01-27 12:15",
          details: "Comissão para parceiro Pedro Costa - R$ 250,00",
        },
        {
          id: "2",
          action: "Cadastrou novo parceiro",
          timestamp: "2024-01-27 10:30",
          details: "Parceiro Ana Silva - Nível Prata",
        },
      ],
    },
    {
      id: "3",
      name: "Ana Costa",
      email: "ana@nomadsjeri.com",
      role: "scanner",
      createdAt: "2024-01-22",
      lastActive: "2024-01-27 16:45",
      status: "active",
      activityLog: [
        {
          id: "1",
          action: "Escaneou QR Code",
          timestamp: "2024-01-27 16:45",
          details: "Promoção Happy Hour - Cliente: Roberto Lima",
        },
        {
          id: "2",
          action: "Escaneou QR Code",
          timestamp: "2024-01-27 16:20",
          details: "Promoção Welcome Drink - Cliente: Fernanda Souza",
        },
      ],
    },
  ])

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const getRoleInfo = (role: UserRole) => {
    switch (role) {
      case "scanner":
        return {
          label: "Scanner",
          color: "bg-blue-100 text-blue-700",
          icon: Shield,
          description: "Apenas escaneia QR codes e visualiza promoções",
        }
      case "colaborador":
        return {
          label: "Colaborador",
          color: "bg-green-100 text-green-700",
          icon: UserCheck,
          description: "Acessa indicações, promoções e comissões do dia a dia, sem permissões administrativas",
        }
      case "admin":
        return {
          label: "Administrativo",
          color: "bg-purple-100 text-purple-700",
          icon: ShieldCheck,
          description: "Gerencia comissões, pagamentos e cadastra parceiros (não pode excluir ou adicionar usuários)",
        }
      case "master":
        return {
          label: "Master",
          color: "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white",
          icon: Crown,
          description: "Acesso total - gerencia todos os cadastros e operações",
        }
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#3E2415] mb-2">Gerenciar Usuários</h2>
            <p className="text-gray-600 text-sm">Gerencie usuários internos da empresa com diferentes permissões</p>
          </div>
          <Button
            onClick={() => setIsAddUserOpen(true)}
            className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90 shadow-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Usuário
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-200 focus:border-[#F58220] focus:ring-[#F58220]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={roleFilter === "all" ? "default" : "outline"}
              onClick={() => setRoleFilter("all")}
              className={
                roleFilter === "all" ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white" : "border-gray-200"
              }
            >
              <Filter className="h-4 w-4 mr-2" />
              Todos
            </Button>
            <Button
              variant={roleFilter === "scanner" ? "default" : "outline"}
              onClick={() => setRoleFilter("scanner")}
              className={roleFilter === "scanner" ? "bg-blue-500 text-white" : "border-gray-200"}
            >
              Scanner
            </Button>
            <Button
              variant={roleFilter === "colaborador" ? "default" : "outline"}
              onClick={() => setRoleFilter("colaborador")}
              className={roleFilter === "colaborador" ? "bg-green-500 text-white" : "border-gray-200"}
            >
              Colaborador
            </Button>
            <Button
              variant={roleFilter === "admin" ? "default" : "outline"}
              onClick={() => setRoleFilter("admin")}
              className={roleFilter === "admin" ? "bg-purple-500 text-white" : "border-gray-200"}
            >
              Admin
            </Button>
            <Button
              variant={roleFilter === "master" ? "default" : "outline"}
              onClick={() => setRoleFilter("master")}
              className={
                roleFilter === "master" ? "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white" : "border-gray-200"
              }
            >
              Master
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const roleInfo = getRoleInfo(user.role)
            const RoleIcon = roleInfo.icon

            return (
              <div
                key={user.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F2680C] via-[#FB9C08] to-[#FFC800] flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#3E2415]">{user.name}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${roleInfo.color}`}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {roleInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{user.email}</p>
                      <p className="text-xs text-gray-500">{roleInfo.description}</p>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                        <span>Cadastrado: {new Date(user.createdAt).toLocaleDateString("pt-BR")}</span>
                        <span>Última atividade: {user.lastActive}</span>
                        <span className={user.status === "active" ? "text-green-600" : "text-red-600"}>
                          {user.status === "active" ? "● Ativo" : "● Inativo"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(user)}
                    className="border-[#F58220] text-[#F58220] hover:bg-[#F58220] hover:text-white"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver Log
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isAddUserOpen && (
        <AddUserModal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          onAdd={(newUser) => {
            setUsers([...users, { ...newUser, id: Date.now().toString(), activityLog: [] }])
            setIsAddUserOpen(false)
          }}
        />
      )}

      {selectedUser && <UserLogModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  )
}

function AddUserModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (user: Omit<User, "id" | "activityLog">) => void
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "scanner" as UserRole,
    status: "active" as "active" | "inactive",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd({
      ...formData,
      createdAt: new Date().toISOString().split("T")[0],
      lastActive: new Date().toLocaleString("pt-BR"),
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white">Adicionar Novo Usuário</h2>
          <p className="text-white/90 text-sm mt-1">Cadastre um novo usuário interno da empresa</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Digite o nome completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@nomadsjeri.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <Input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Senha de acesso"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Usuário</label>
            <div className="space-y-3">
              {(["scanner", "colaborador", "admin", "master"] as UserRole[]).map((role) => {
                const info = {
                  scanner: {
                    label: "Scanner",
                    description: "Apenas escaneia QR codes e visualiza promoções",
                    icon: Shield,
                  },
                  colaborador: {
                    label: "Colaborador",
                    description: "Acessa indicações, promoções e comissões do dia a dia, sem permissões administrativas",
                    icon: UserCheck,
                  },
                  admin: {
                    label: "Administrativo",
                    description: "Gerencia comissões, pagamentos e cadastra parceiros",
                    icon: ShieldCheck,
                  },
                  master: {
                    label: "Master",
                    description: "Acesso total - gerencia todos os cadastros",
                    icon: Crown,
                  },
                }[role]

                const RoleIcon = info.icon

                return (
                  <label
                    key={role}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.role === role ? "border-[#F58220] bg-orange-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={formData.role === role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <RoleIcon className="h-4 w-4" />
                        {info.label}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{info.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white hover:opacity-90"
            >
              Adicionar Usuário
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UserLogModal({ user, onClose }: { user: User; onClose: () => void }) {
  const roleInfo = {
    scanner: { label: "Scanner", icon: Shield, color: "bg-blue-100 text-blue-700" },
    colaborador: { label: "Colaborador", icon: UserCheck, color: "bg-green-100 text-green-700" },
    admin: { label: "Administrativo", icon: ShieldCheck, color: "bg-purple-100 text-purple-700" },
    master: {
      label: "Master",
      icon: Crown,
      color: "bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white",
    },
  }[user.role]

  const RoleIcon = roleInfo.icon

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-[#3E2415] via-[#F58220] to-[#FFC800] p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-white mb-2">Log de Atividades</h2>
          <div className="flex items-center gap-3 text-white/90">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm">{user.email}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ml-auto ${roleInfo.color}`}
            >
              <RoleIcon className="h-3 w-3" />
              {roleInfo.label}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Informações do Usuário</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Cadastrado em:</span>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <div>
                <span className="text-gray-600">Última atividade:</span>
                <p className="font-medium">{user.lastActive}</p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className={`font-medium ${user.status === "active" ? "text-green-600" : "text-red-600"}`}>
                  {user.status === "active" ? "Ativo" : "Inativo"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-4">Histórico de Atividades</h3>
            <div className="space-y-3">
              {user.activityLog.map((log) => (
                <div key={log.id} className="border-l-4 border-[#F58220] pl-4 py-2 bg-orange-50 rounded-r-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={onClose} className="w-full mt-6 bg-gradient-to-r from-[#F2680C] via-[#FB9C08] to-[#FFC800] text-white">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
