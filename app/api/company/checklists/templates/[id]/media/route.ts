import { prisma } from "@/lib/prisma"
import { requireCompanyStaff, requireCapability, handleApiError, ApiError } from "@/lib/api-auth"
import { canManageDailyOperations } from "@/lib/permissions"
import { uploadImage } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

/**
 * Upload da foto/vídeo explicativo de um template — exibido no modal de
 * instruções ao colaborador clicar no título da tarefa (ver
 * app/company/checklists). Rota separada do PATCH principal (JSON) porque
 * aqui o corpo é multipart/form-data.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCompanyStaff()
    requireCapability(user, canManageDailyOperations)
    const { id } = await params
    const companyId = user.companyId

    const existing = await prisma.checklistTemplate.findFirst({ where: { id, companyId } })
    if (!existing) throw new ApiError(404, "Tarefa não encontrada")

    const formData = await request.formData()
    const photo = formData.get("photo")
    const video = formData.get("video")

    const data: { instructionPhotoUrl?: string; instructionVideoUrl?: string } = {}
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > 8 * 1024 * 1024) throw new ApiError(400, "Foto excede 8MB")
      data.instructionPhotoUrl = await uploadImage("checklists", photo)
    }
    if (video instanceof File && video.size > 0) {
      if (video.size > 50 * 1024 * 1024) throw new ApiError(400, "Vídeo excede 50MB")
      data.instructionVideoUrl = await uploadImage("checklists", video)
    }
    if (Object.keys(data).length === 0) throw new ApiError(400, "Envie uma foto e/ou vídeo")

    const template = await prisma.checklistTemplate.update({ where: { id }, data })

    await logAudit({ userId: user.id, companyId, action: "UPDATE", entity: "ChecklistTemplate", entityId: id, details: { mediaUpdated: Object.keys(data) } })

    return Response.json(template)
  } catch (error) {
    return handleApiError(error)
  }
}
