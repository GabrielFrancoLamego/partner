/**
 * Converte a planilha exportada `prisma/parceiros.csv` para o formato
 * `LegacyPartnerRecord[]` consumido por `prisma/seed-partners.ts`, gravando
 * `prisma/partners-data.json` (git-ignorado — nunca commitar dado real de
 * parceiro).
 *
 * A planilha original é um CADASTRO (nome, contato, unidade atendida), não um
 * extrato financeiro: não existe coluna de saldo nem de nível (Prata/Ouro/
 * Diamante). Este script NÃO inventa esses valores — grava `currentBalance:
 * 0` e deixa o nível de programa em branco (sem currentLevelId) para todo
 * mundo, até que os dados financeiros reais cheguem. Tudo que a planilha
 * realmente tem (nome, apelido, telefone/WhatsApp, PIX, unidade, status,
 * observações) é importado.
 *
 * Uso: npx tsx prisma/convert-csv-to-json.ts
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const CSV_FILE = path.join(__dirname, "parceiros.csv")
const OUT_FILE = path.join(__dirname, "partners-data.json")

const COMPANY_BY_HEADER: Record<string, string> = {
  "Atende Nomad's Jeri": "nomads-jeri",
  "Atende Nomad's Lagoa": "nomads-lagoa",
  "Atende IN-ON": "in-on",
}
// Prioridade quando mais de uma unidade está marcada (LegacyPartnerRecord só aceita uma companySlug hoje).
const COMPANY_PRIORITY = ["nomads-jeri", "nomads-lagoa", "in-on"]

type Row = Record<string, string>

/** Parser CSV completo (RFC4180) — respeita vírgulas e quebras de linha dentro de campos entre aspas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ",") {
      row.push(field)
      field = ""
      i++
      continue
    }
    if (ch === "\r") {
      i++
      continue
    }
    if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i++
      continue
    }
    field += ch
    i++
  }
  row.push(field)
  if (row.length > 1 || row[0] !== "") rows.push(row)
  return rows
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "")
}

/** Remove acentos da parte local do e-mail — Supabase Auth rejeita "PabloPílio@..." como formato inválido. */
function stripAccentsFromLocalPart(email: string) {
  const [local, domain] = email.split("@")
  const asciiLocal = local.normalize("NFD").replace(/\p{Diacritic}/gu, "")
  return `${asciiLocal}@${domain}`
}

/** Tenta validar/consertar um valor de e-mail; se não der, tenta reaproveitar como telefone ou CPF quando o dado claramente foi digitado na coluna errada. */
function resolveEmailColumn(raw: string): { email: string | null; recoveredPhone: string | null; recoveredDoc: string | null; note: string | null } {
  const v = raw.trim()
  if (!v) return { email: null, recoveredPhone: null, recoveredDoc: null, note: null }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    const normalized = stripAccentsFromLocalPart(v.toLowerCase())
    const note = normalized !== v.toLowerCase() ? `E-mail normalizado de "${v}" (parte local tinha acento — inválido para autenticação)` : null
    return { email: normalized, recoveredPhone: null, recoveredDoc: null, note }
  }

  // "fulano.gmail.com" -> faltou só o @
  const missingAt = v.match(/^([^\s@]+)\.(gmail|hotmail|yahoo|outlook|icloud|live|bol)\.com$/i)
  if (missingAt) {
    const repaired = stripAccentsFromLocalPart(`${missingAt[1]}@${missingAt[2]}.com`.toLowerCase())
    return { email: repaired, recoveredPhone: null, recoveredDoc: null, note: `E-mail corrigido de "${v}" (faltava @)` }
  }

  const digits = onlyDigits(v)
  const looksLikeCpf = digits.length === 11 && (/[.\-]/.test(v) || /cpf/i.test(v))
  if (looksLikeCpf) {
    return { email: null, recoveredPhone: null, recoveredDoc: digits, note: `CPF recuperado da coluna E-mail: "${v}"` }
  }
  const looksLikePhone = digits.length >= 8 && digits.length <= 11
  if (looksLikePhone) {
    return { email: null, recoveredPhone: digits, recoveredDoc: null, note: `Telefone recuperado da coluna E-mail: "${v}"` }
  }

  return { email: null, recoveredPhone: null, recoveredDoc: null, note: `Valor na coluna E-mail não reconhecido, mantido só como observação: "${v}"` }
}

function parseBrDate(raw: string): string | undefined {
  const v = raw.trim()
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  const [, d, mo, y] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function main() {
  const raw = readFileSync(CSV_FILE, "utf-8")
  const grid = parseCsv(raw)

  const headerIndex = grid.findIndex((r) => r[0]?.trim() === "ID")
  if (headerIndex === -1) throw new Error(`Não encontrei a linha de cabeçalho (coluna "ID") em ${CSV_FILE}`)
  // Normaliza quebras de linha/espaços duplos dentro de células de cabeçalho
  // (ex: "Mensagem Inicial \nOnboarding" -> "Mensagem Inicial Onboarding").
  const header = grid[headerIndex].map((h) => h.replace(/\s+/g, " ").trim())
  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) console.warn(`⚠ Coluna "${name}" não encontrada no cabeçalho`)
    return idx
  }

  const idx = {
    id: col("ID"),
    nome: col("Nome"),
    apelido: col("Apelido"),
    exibicao: col("Nome de Exibição"),
    captador: col("Captador / Indicado por"),
    documento: col("Documento"),
    local: col("Local de Trabalho"),
    telefone: col("Telefone"),
    pix: col("Chave PIX"),
    email: col("E-mail"),
    entrada: col("Data de Entrada"),
    modelo: col("Modelo de Comissão"),
    pctComissao: col("% Comissão Padrão"),
    valorFixo: col("Valor Fixo p/ Voucher (R$)"),
    status: col("Status"),
    observacoes: header.length - 1, // última coluna
  }

  const dataRows: Row[] = []
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const r = grid[i]
    if (!/^P\d+$/.test(r[idx.id]?.trim() ?? "")) continue // ignora linhas em branco, título e legenda
    const obj: Row = {}
    header.forEach((h, colIdx) => (obj[h] = r[colIdx] ?? ""))
    obj.__raw = JSON.stringify(r)
    dataRows.push(obj)
  }

  const usedNicknames = new Set<string>()
  const records: unknown[] = []
  const skipped: string[] = []
  let placeholderEmails = 0
  let repairedEmails = 0
  let recoveredFromEmailCol = 0
  let noCompanyMarked = 0

  for (const row of dataRows) {
    const id = row["ID"].trim()
    const name = row["Nome"]?.trim()
    const displayName = row["Nome de Exibição"]?.trim()
    const apelido = row["Apelido"]?.trim()
    const local = row["Local de Trabalho"]?.trim()
    const captador = row["Captador / Indicado por"]?.trim()
    const documento = row["Documento"]?.trim()
    const telefoneRaw = row["Telefone"]?.trim()
    const pix = row["Chave PIX"]?.trim()
    const emailRaw = row["E-mail"]?.trim() ?? ""
    const entrada = row["Data de Entrada"]?.trim()
    const modelo = row["Modelo de Comissão"]?.trim()
    const pctComissao = row["% Comissão Padrão"]?.trim()
    const valorFixo = row["Valor Fixo p/ Voucher (R$)"]?.trim()
    const status = row["Status"]?.trim()
    const observacoes = row[header[header.length - 1]]?.trim()
    const onboarding = row["Mensagem Inicial Onboarding"]?.trim()

    if (!name) {
      skipped.push(`${id}: sem nome cadastrado — nada de identificável para importar`)
      continue
    }

    // --- Empresa vinculada ---
    const marked = Object.entries(COMPANY_BY_HEADER)
      .filter(([header]) => row[header]?.trim().toLowerCase() === "sim")
      .map(([, slug]) => slug)
    let companySlug = COMPANY_PRIORITY.find((s) => marked.includes(s))
    const extraCompanyNote =
      marked.length > 1 ? `Também atende: ${marked.filter((m) => m !== companySlug).join(", ")} (só a unidade principal foi vinculada aqui)` : null
    if (!companySlug) {
      companySlug = "nomads-jeri" // única unidade presente nesta planilha
      noCompanyMarked++
    }

    // --- E-mail (com recuperação de valores mal digitados) ---
    const emailResolution = resolveEmailColumn(emailRaw)
    let email = emailResolution.email
    let phone = telefoneRaw ? onlyDigits(telefoneRaw) : undefined
    let document = documento || undefined
    if (emailResolution.recoveredPhone && !phone) {
      phone = emailResolution.recoveredPhone
      recoveredFromEmailCol++
    }
    if (emailResolution.recoveredDoc && !document) {
      document = emailResolution.recoveredDoc
      recoveredFromEmailCol++
    }
    if (emailResolution.note?.startsWith("E-mail corrigido")) repairedEmails++

    if (!email) {
      email = `parceiro.${id.toLowerCase()}@sememail.tribuss.local`
      placeholderEmails++
    }

    // --- Apelido/nickname, deduplicado ---
    let nickname = displayName || apelido || name.split(" ")[0]
    nickname = nickname.trim()
    if (nickname && usedNicknames.has(nickname.toLowerCase())) {
      nickname = `${nickname}-${id}`
    }
    if (nickname) usedNicknames.add(nickname.toLowerCase())

    // --- Observações consolidadas (nada da planilha original é descartado) ---
    const bioParts: string[] = [`Registro original: ${id}`]
    if (local) bioParts.push(`Trabalha em: ${local}`)
    if (captador) bioParts.push(`Indicado por: ${captador}`)
    if (modelo) {
      const detalhe = modelo.includes("%") ? pctComissao : valorFixo ? `R$ ${valorFixo}` : null
      bioParts.push(`Modelo de comissão: ${modelo}${detalhe ? ` (${detalhe})` : ""}`)
    }
    if (extraCompanyNote) bioParts.push(extraCompanyNote)
    if (noCompanyMarked && companySlug === "nomads-jeri" && marked.length === 0) {
      bioParts.push("⚠ Nenhuma unidade marcada no cadastro original — associado à Nomad's Jeri por padrão, confirmar")
    }
    if (emailResolution.note) bioParts.push(emailResolution.note)
    if (!emailResolution.email && placeholderEmails) bioParts.push("⚠ Sem e-mail real cadastrado — login provisório gerado automaticamente")
    if (onboarding) bioParts.push(`Onboarding: ${onboarding}`)
    if (observacoes) bioParts.push(`Obs: ${observacoes}`)
    bioParts.push("⚠ Saldo e nível de programa não constam na planilha de cadastro — pendente de dados financeiros reais")

    records.push({
      companySlug,
      name: name,
      fullName: name,
      nickname: nickname || undefined,
      email,
      phone,
      whatsapp: phone,
      document,
      partnerType: "INDIVIDUAL",
      pixKey: pix || undefined,
      currentBalance: 0,
      status: status === "Inativo" ? "INACTIVE" : "ACTIVE",
      registeredAt: parseBrDate(entrada || ""),
      bio: bioParts.join(" · "),
    })
  }

  writeFileSync(OUT_FILE, JSON.stringify(records, null, 2), "utf-8")

  console.log(`Linhas com ID lidas: ${dataRows.length}`)
  console.log(`Registros convertidos: ${records.length}`)
  console.log(`Ignorados (sem nome): ${skipped.length}`)
  for (const s of skipped) console.log(`  - ${s}`)
  console.log(`E-mails corrigidos automaticamente (faltava @): ${repairedEmails}`)
  console.log(`Telefone/CPF recuperado da coluna E-mail: ${recoveredFromEmailCol}`)
  console.log(`E-mails provisórios gerados (sem e-mail real na planilha): ${placeholderEmails}`)
  console.log(`Sem unidade marcada (associado à Nomad's Jeri por padrão): ${noCompanyMarked}`)
  console.log(`\n⚠ Nenhum saldo (walletBalance) ou nível de programa (Prata/Ouro/Diamante) existe na planilha —`)
  console.log(`  todos os registros saem com currentBalance: 0 e sem nível atribuído.`)
  console.log(`\nGravado em ${OUT_FILE}`)
}

main()
