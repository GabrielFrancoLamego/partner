/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Geração de Excel/PDF do Financeiro roda no servidor (ver lib/finance-export.ts) — não empacotar.
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"],
}

export default nextConfig
