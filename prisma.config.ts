import { config as loadEnv } from "dotenv"
import { defineConfig, env } from "prisma/config"

loadEnv({ path: ".env.local" })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Conexão direta (session pooler), necessária para migrations — o pooler de
    // transação (DATABASE_URL) não suporta os locks usados pelo `prisma migrate`.
    url: env("DIRECT_URL"),
  },
})
