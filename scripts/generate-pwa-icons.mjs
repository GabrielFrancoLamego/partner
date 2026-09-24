// Regenera os ícones PWA (public/icons/*) a partir dos assets oficiais em
// public/brand/. Rodar de novo sempre que a marca (cores/símbolo) mudar.
// Uso: node scripts/generate-pwa-icons.mjs
import sharp from "sharp"
import { mkdirSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const brand = path.join(root, "public", "brand")
const outDir = path.join(root, "public", "icons")
mkdirSync(outDir, { recursive: true })

const gradientSvg = (size) => Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F2680C" />
      <stop offset="52%" stop-color="#FB9C08" />
      <stop offset="100%" stop-color="#FFC800" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)" />
</svg>`)

async function main() {
  const iconSource = path.join(brand, "tribuss-icone-app.png")
  const symbolSource = path.join(brand, "tribuss-simbolo-branco.png")

  // Ícones "any" — ícone completo, o browser/SO aplica seu próprio recorte.
  for (const size of [192, 512]) {
    await sharp(iconSource).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`))
    console.log("wrote icon-" + size + ".png")
  }

  // Ícones "maskable" — fundo sólido de ponta a ponta (sem cantos
  // arredondados/transparência) com o glifo confinado à safe zone (~64%),
  // para a máscara do Android (círculo, squircle, etc.) nunca cortar o símbolo.
  for (const size of [192, 512]) {
    const glyphWidth = Math.round(size * 0.56)
    const glyph = await sharp(symbolSource).resize(glyphWidth, glyphWidth, { fit: "inside" }).toBuffer()
    const glyphMeta = await sharp(glyph).metadata()
    const left = Math.round((size - (glyphMeta.width ?? glyphWidth)) / 2)
    const top = Math.round((size - (glyphMeta.height ?? glyphWidth)) / 2)

    await sharp(gradientSvg(size))
      .composite([{ input: glyph, left, top }])
      .png()
      .toFile(path.join(outDir, `icon-maskable-${size}.png`))
    console.log("wrote icon-maskable-" + size + ".png")
  }

  // Apple touch icon — 180x180, o tamanho que o iOS de fato pede.
  await sharp(iconSource).resize(180, 180).png().toFile(path.join(outDir, "apple-touch-icon-180.png"))
  console.log("wrote apple-touch-icon-180.png")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
