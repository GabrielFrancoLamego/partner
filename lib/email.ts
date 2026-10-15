import "server-only"

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
const DEFAULT_FROM = "Tribuss <nao-responda@tribuss.app>"

/** "Nome <email@dominio>" → { name, email }; aceita também só o endereço. */
function parseSender(raw: string) {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return { name: match[1].trim() || "Tribuss", email: match[2].trim() }
  return { name: "Tribuss", email: raw.trim() }
}

/**
 * Envio transacional único da plataforma (Brevo). Best-effort: sem
 * BREVO_API_KEY (ambiente local/sem provedor) ou com falha na API, devolve
 * `false` sem lançar — quem chama já tem o link/HTML para envio manual.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return false

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: parseSender(process.env.EMAIL_FROM_ADDRESS || DEFAULT_FROM),
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
      }),
    })
    if (!response.ok) {
      console.error("[email] Brevo recusou o envio:", response.status, await response.text().catch(() => ""))
      return false
    }
    return true
  } catch (error) {
    console.error("[email] Falha ao chamar o Brevo:", error)
    return false
  }
}
