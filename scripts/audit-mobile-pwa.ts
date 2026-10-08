import "./audit-lib"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, type Page, type BrowserContext } from "playwright"
import { loginAs, api, BASE_URL } from "./audit-lib"

/**
 * Auditoria de responsividade mobile/PWA com navegador REAL (Chromium, viewport de
 * smartphone 390x844, toque habilitado): para cada tela dos portais mede
 *  - estouro lateral (scrollWidth > largura da tela),
 *  - alvos de toque menores que 44px (botões, abas, selects, campos, links de navegação).
 * Também confere a barra inferior do parceiro com o botão central [+ GERAR VOUCHER].
 * Uso: npx tsx scripts/audit-mobile-pwa.ts   (dev server em http://localhost:3000)
 */
const VIEWPORT = { width: 390, height: 844 }
const MIN_TOUCH = Number(process.env.MIN_TOUCH ?? 44) // MIN_TOUCH=70 serve de controle negativo (deve acusar vários alvos)
const OUT_DIR = path.join(os.tmpdir(), "tribuss-mobile-audit")
fs.mkdirSync(OUT_DIR, { recursive: true })

type Finding = { page: string; kind: "overflow" | "touch" | "erro"; detail: string }
const findings: Finding[] = []
let pagesChecked = 0
let elementsMeasured = 0

async function contextFor(browser: Awaited<ReturnType<typeof chromium.launch>>, email: string | null): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" })
  if (email) {
    const session = await loginAs(email)
    await context.addCookies([...session.jar.entries()].map(([name, value]) => ({ name, value, url: BASE_URL })))
  }
  return context
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {})
  await page.waitForFunction(() => !document.body.innerText.includes("Carregando"), undefined, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
}

/** Mede estouro lateral e alvos de toque da tela atual. */
async function measure(page: Page, label: string) {
  pagesChecked++
  const result = await page.evaluate((min) => {
    const vw = window.innerWidth
    const overflowing = document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1
    const offenders: string[] = []
    if (overflowing) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const r = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        if (r.width > 0 && r.right > vw + 1 && style.position !== "fixed" && !el.closest(".overflow-x-auto, .overflow-x-scroll, .scrollbar-hide, [data-radix-scroll-area-viewport]")) {
          offenders.push(`${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").split(" ").slice(0, 3).join(".")} (${Math.round(r.right)}px)`)
          if (offenders.length >= 4) break
        }
      }
    }

    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([role="checkbox"]):not([role="switch"]):not([role="radio"]), [role="button"], [role="tab"], [role="combobox"], input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]):not([type="range"]), textarea, select, nav a, [role="menuitem"], a[class*="min-h-"]',
      ),
    )
    const small: string[] = []
    for (const el of interactive) {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || style.display === "none" || el.closest("[hidden], [aria-hidden='true'], .sr-only")) continue
      if (el.closest(".leaflet-container")) continue // controles do mapa (zoom +/−) são do Leaflet
      const iconOnly = !el.textContent?.trim() && el.querySelector("svg")
      if (r.height < min - 0.5 || (iconOnly && r.width < min - 0.5)) {
        small.push(`${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""} "${(el.textContent ?? "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
    return { overflowing, offenders, small, measured: interactive.length, textLength: document.body.innerText.trim().length, scrollWidth: document.documentElement.scrollWidth, vw }
  }, MIN_TOUCH)

  elementsMeasured += result.measured
  if (process.env.VERBOSE) console.log(`  · ${label}: ${result.measured} elementos`)
  if (result.measured === 0 && result.textLength < 150) findings.push({ page: label, kind: "erro", detail: "nenhum elemento interativo medido — a tela não renderizou?" })
  if (result.overflowing) {
    findings.push({ page: label, kind: "overflow", detail: `scrollWidth ${result.scrollWidth} > ${result.vw}; ${result.offenders.join(" | ")}` })
    await page.screenshot({ path: path.join(OUT_DIR, `overflow-${label.replace(/[^\w]+/g, "_")}.png`), fullPage: false }).catch(() => {})
  }
  if (result.small.length > 0) {
    findings.push({ page: label, kind: "touch", detail: `${result.small.length} alvo(s) < ${MIN_TOUCH}px: ${result.small.slice(0, 4).join(" | ")}` })
  }
}

async function visit(context: BrowserContext, pathName: string, label = pathName, after?: (page: Page) => Promise<void>) {
  const page = await context.newPage()
  try {
    const response = await page.goto(`${BASE_URL}${pathName}`, { waitUntil: "domcontentloaded", timeout: 90000 })
    if (!response || response.status() >= 400) findings.push({ page: label, kind: "erro", detail: `HTTP ${response?.status()}` })
    await settle(page)
    const finalPath = new URL(page.url()).pathname
    if (finalPath !== pathName.split("?")[0]) findings.push({ page: label, kind: "erro", detail: `redirecionou para ${finalPath}` })
    if (await page.locator("text=Application error").count()) findings.push({ page: label, kind: "erro", detail: "Application error na tela" })
    await measure(page, label)
    if (after) {
      await after(page)
      await settle(page)
      await measure(page, `${label} (após interação)`)
    }
  } catch (e) {
    findings.push({ page: label, kind: "erro", detail: e instanceof Error ? e.message.split("\n")[0] : String(e) })
  } finally {
    await page.close()
  }
}

async function main() {
  const browser = await chromium.launch()

  // código de voucher real para a página pública do cliente
  const partnerSession = await loginAs("parceiro@teste.com.vc")
  const options = (await api(partnerSession, "GET", "/api/partner/vouchers")).json as { id: string; promotions: { id: string }[] }[]
  const opt = options.find((o) => o.promotions.length > 0)
  let voucherCode = ""
  if (opt) {
    const v = await api(partnerSession, "POST", "/api/partner/vouchers", { companyId: opt.id, promotionId: opt.promotions[0].id, clientName: "[MobileAudit] Cliente", noContact: true })
    voucherCode = v.json?.voucher?.code ?? ""
  }

  // ---------- Público ----------
  const pub = await contextFor(browser, null)
  for (const p of ["/", "/privacidade", "/termos", "/offline"]) await visit(pub, p)
  if (voucherCode) await visit(pub, `/voucher/${voucherCode}`, "/voucher/[código]")
  await pub.close()

  // ---------- Master ----------
  const master = await contextFor(browser, "master@teste.com.vc")
  for (const p of [
    "/company",
    "/company/financeiro?tab=contas-a-pagar",
    "/company/financeiro?tab=comissoes-saques",
    "/company/financeiro?tab=quitacoes",
    "/company/ocorrencias",
    "/company/configuracoes",
    "/company/checklists",
    "/company/colaboradores",
    "/company/metas",
    "/company/mural",
    "/company/fechamento",
    "/company/scanner",
    "/company/folha-pagamento",
    "/company/perfil",
  ])
    await visit(master, p)
  await visit(master, "/company/financeiro?tab=recebiveis", "/company/financeiro?tab=recebiveis", async (page) => {
    await page.getByRole("button", { name: /Detalhar/ }).first().click({ timeout: 5000 }).catch(() => {})
  })
  // Mapa do estabelecimento: o pin existe, é arrastável no celular e as coordenadas mudam (não salva nada).
  await visit(master, "/company/configuracoes", "[mapa] pin arrastável em /company/configuracoes", async (page) => {
    const readCoords = async () => (await page.getByText(/Pin em/).first().textContent().catch(() => null)) ?? ""
    const container = page.locator(".leaflet-container").first()
    await container.scrollIntoViewIfNeeded()
    const cBox = await container.boundingBox()
    if (!cBox || cBox.width > VIEWPORT.width + 1) findings.push({ page: "mapa", kind: "overflow", detail: `mapa com ${cBox?.width}px de largura` })
    const marker = page.locator(".leaflet-marker-draggable").first()
    if ((await marker.count()) === 0) {
      findings.push({ page: "mapa", kind: "erro", detail: "pin arrastável não encontrado (empresa sem coordenadas?)" })
      return
    }
    const before = await readCoords()
    const box = await marker.boundingBox()
    if (box) {
      const x = box.x + box.width / 2
      const y = box.y + box.height - 4
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 40, y + 30, { steps: 8 })
      await page.mouse.up()
    }
    await page.waitForTimeout(400)
    const after = await readCoords()
    if (!before || before === after) findings.push({ page: "mapa", kind: "erro", detail: `arrastar o pin não alterou as coordenadas (${before} → ${after})` })
  })
  await master.close()

  // ---------- Financeiro (colaborador com a flag) e Colaborador ----------
  const fin = await contextFor(browser, "financeiro@teste.com.vc")
  for (const p of ["/company", "/company/ocorrencias", "/company/financeiro?tab=contas-a-pagar", "/company/crescimento"]) await visit(fin, `${p}`, `[financeiro] ${p}`)
  await fin.close()

  const colab = await contextFor(browser, "colaborador@teste.com.vc")
  for (const p of ["/company", "/company/crescimento", "/company/metas", "/company/ponto", "/company/checklists", "/company/perfil", "/company/mural"]) await visit(colab, p, `[colaborador] ${p}`)
  await colab.close()

  // ---------- Parceiro ----------
  const partner = await contextFor(browser, "parceiro@teste.com.vc")
  for (const p of ["/partner", "/partner/promocoes", "/partner/promocoes?tab=descobrir", "/partner/comissoes", "/partner/carteira/saques", "/partner/mapa", "/partner/perfil", "/partner/explorar", "/partner/nivel", "/partner/ajuda"])
    await visit(partner, p, `[parceiro] ${p}`)

  // Barra inferior com o botão central + abertura do gerador de voucher
  await visit(partner, "/partner", "[parceiro] barra inferior + gerador de voucher", async (page) => {
    const fab = page.getByRole("button", { name: /Gerar voucher/i }).first()
    const box = await fab.boundingBox()
    if (!box) {
      findings.push({ page: "barra inferior", kind: "erro", detail: "botão [+ GERAR VOUCHER] não encontrado na barra inferior" })
      return
    }
    const centerX = box.x + box.width / 2
    if (Math.abs(centerX - VIEWPORT.width / 2) > 24) findings.push({ page: "barra inferior", kind: "erro", detail: `botão fora do centro (x=${Math.round(centerX)})` })
    if (box.height < MIN_TOUCH || box.width < MIN_TOUCH) findings.push({ page: "barra inferior", kind: "touch", detail: `botão ${Math.round(box.width)}x${Math.round(box.height)}` })
    if (box.y + box.height < VIEWPORT.height * 0.8) findings.push({ page: "barra inferior", kind: "erro", detail: "botão não está na parte inferior da tela" })
    await fab.click()
    await page.getByText("Gerar voucher", { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => {})
  })
  await partner.close()

  // ---------- Admin ----------
  const admin = await contextFor(browser, "admin@teste.com.vc")
  for (const p of ["/admin", "/admin/financeiro", "/admin/operacoes", "/admin/cadastros"]) await visit(admin, p, `[admin] ${p}`)
  await admin.close()

  await browser.close()

  console.log(`\n=== AUDITORIA MOBILE (390x844, toque) — ${pagesChecked} telas, ${elementsMeasured} elementos interativos medidos ===`)
  if (findings.length === 0) console.log("✓ Nenhum estouro lateral, nenhum alvo de toque < 44px, nenhuma tela com erro.")
  for (const f of findings) console.log(`✗ [${f.kind}] ${f.page} — ${f.detail}`)
  console.log(`\nCapturas dos estouros (se houver): ${OUT_DIR}`)
  if (findings.length > 0) process.exitCode = 1
}

main()
