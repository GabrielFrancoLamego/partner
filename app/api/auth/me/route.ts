import { getCurrentUser } from "@/lib/current-user"

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return Response.json({ error: "Não autenticado" }, { status: 401, headers: { "Cache-Control": "private, no-store" } })
  }

  return Response.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
