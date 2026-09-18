import "server-only"
import { Resend } from "resend"
import type { NotificationType } from "@prisma/client"
import { prisma } from "./prisma"
import { buildWhatsAppShareUrl } from "./promotion-share"

type NotifyInput = {
  userId: string
  type: NotificationType
  title: string
  message: string
  linkUrl?: string
  /** Email do destinatário, quando disponível — best-effort via Resend (ver trySendEmail). */
  email?: string | null
  /** Telefone/WhatsApp do destinatário — gera um link wa.me como fallback manual (sem API paga). */
  phone?: string | null
}

async function trySendEmail(to: string, title: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS || "Tribuss <onboarding@resend.dev>",
      to,
      subject: title,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h1 style="font-size:18px; color:#3E2415;">${title}</h1>
          <p style="color:#555; font-size:14px; line-height:1.5;">${message}</p>
        </div>
      `.trim(),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Cria a notificação em-app (fonte da verdade do sino) e, em paralelo, tenta
 * o e-mail (Resend, best-effort) e monta o link de WhatsApp de fallback —
 * mesmo padrão de canais "sem garantia de entrega automática" já usado em
 * lib/promotion-share.ts e lib/admin-user.ts (não há gateway de WhatsApp
 * contratado; o link fica pronto na UI para envio manual de 1 clique).
 */
export async function notifyUser(input: NotifyInput) {
  const emailSent = input.email ? await trySendEmail(input.email, input.title, input.message) : false
  const whatsappUrl = input.phone ? buildWhatsAppShareUrl(input.phone, `${input.title}\n${input.message}`) : null

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      linkUrl: input.linkUrl,
      emailSent,
      whatsappUrl,
    },
  })
}

/** Notifica todos os Masters/Gerentes de uma empresa (usado por novos cadastros pendentes, pendências de fatura, etc). */
export async function notifyCompanyManagement(
  companyId: string,
  payload: Omit<NotifyInput, "userId" | "email" | "phone">,
) {
  const managers = await prisma.user.findMany({
    where: { companyId, role: { in: ["COMPANY_MASTER", "COMPANY_GERENTE"] }, status: "ACTIVE" },
    select: { id: true, email: true, phone: true },
  })
  await Promise.all(managers.map((m) => notifyUser({ ...payload, userId: m.id, email: m.email, phone: m.phone })))
}

/**
 * Best-effort por email, sem Notification em-app — usado quando ainda não
 * existe um User (ex: cadastro reprovado, que nunca chega a virar conta).
 */
export async function notifyEmailOnly(email: string, title: string, message: string) {
  await trySendEmail(email, title, message)
}

/** Notifica todos os Admins da plataforma. */
export async function notifyPlatformAdmins(payload: Omit<NotifyInput, "userId" | "email" | "phone">) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true, email: true, phone: true },
  })
  await Promise.all(admins.map((a) => notifyUser({ ...payload, userId: a.id, email: a.email, phone: a.phone })))
}
