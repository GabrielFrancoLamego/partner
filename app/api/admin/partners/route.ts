import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin, handleApiError, ApiError } from "@/lib/api-auth"
import { createPlatformUser } from "@/lib/admin-user"
import { logAudit } from "@/lib/audit"

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim()

    const partners = await prisma.user.findMany({
      where: {
        role: "PARTNER",
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { partnerProfile: { bio: { contains: q, mode: "insensitive" } } },
                { partnerProfile: { nickname: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        partnerProfile: { include: { parent: { select: { id: true, user: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(partners)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin()
    const body = await request.json()
    const { email, name, partnerType, document, phone, fullName, nickname, whatsapp, contactEmail, cpf, bio } = body

    if (!email || !name) {
      throw new ApiError(400, "Email e nome são obrigatórios")
    }
    if (!whatsapp) {
      throw new ApiError(400, "WhatsApp é obrigatório")
    }

    const user = await createPlatformUser({
      email,
      name,
      role: "PARTNER",
      partnerType: partnerType ?? "INDIVIDUAL",
      document,
      phone,
      fullName,
      nickname,
      whatsapp,
      contactEmail,
      cpf,
      bio,
    })

    await logAudit({
      userId: admin.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      details: { email, name, role: "PARTNER", partnerType, document, phone, whatsapp },
    })

    return Response.json(user, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
