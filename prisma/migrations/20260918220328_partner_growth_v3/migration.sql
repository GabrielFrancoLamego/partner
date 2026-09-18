-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'PAUSED_FOR_NEW_MEMBERS', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgramMembershipStatus" AS ENUM ('ACTIVE', 'LEFT_BY_PARTNER', 'TERMINATED_INACTIVITY', 'PROGRAM_ENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PROGRAM_PAUSED';
ALTER TYPE "NotificationType" ADD VALUE 'PROGRAM_RULES_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'PROGRAM_MEMBERSHIP_ENDED';
ALTER TYPE "NotificationType" ADD VALUE 'PARTNER_PERFORMANCE_MONTHLY';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "avgRating" DECIMAL(3,2),
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "segment" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "pauseEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ProgramChangeLog" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMembership" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "status" "ProgramMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChangeAckAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "forfeitedBalance" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRating" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramChangeLog_programId_idx" ON "ProgramChangeLog"("programId");

-- CreateIndex
CREATE INDEX "ProgramChangeLog_createdAt_idx" ON "ProgramChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "ProgramMembership_partnerId_idx" ON "ProgramMembership"("partnerId");

-- CreateIndex
CREATE INDEX "ProgramMembership_companyId_idx" ON "ProgramMembership"("companyId");

-- CreateIndex
CREATE INDEX "ProgramMembership_status_idx" ON "ProgramMembership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramMembership_programId_partnerId_key" ON "ProgramMembership"("programId", "partnerId");

-- CreateIndex
CREATE INDEX "CompanyRating_companyId_idx" ON "CompanyRating"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRating_companyId_partnerId_key" ON "CompanyRating"("companyId", "partnerId");

-- AddForeignKey
ALTER TABLE "ProgramChangeLog" ADD CONSTRAINT "ProgramChangeLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramChangeLog" ADD CONSTRAINT "ProgramChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMembership" ADD CONSTRAINT "ProgramMembership_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMembership" ADD CONSTRAINT "ProgramMembership_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRating" ADD CONSTRAINT "CompanyRating_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRating" ADD CONSTRAINT "CompanyRating_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: programas já desativados (active=false) não tinham essa
-- distinção antes — o mais próximo do comportamento anterior (totalmente
-- fora do ar, sem janela de 30 dias) é ARCHIVED, não PAUSED_FOR_NEW_MEMBERS.
UPDATE "Program" SET "status" = 'ARCHIVED', "archivedAt" = "updatedAt" WHERE "active" = false;

-- DataMigration: backfill de ProgramMembership para todo par parceiro/empresa
-- que já tem histórico de Commission — sem isso, parceiros com anos de
-- indicações apareceriam como "ainda não participam" do programa em
-- /partner/explorar assim que a feature for ao ar.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "ProgramMembership" ("id", "programId", "companyId", "partnerId", "status", "joinedAt", "lastActivityAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."id",
  c."companyId",
  c."partnerId",
  'ACTIVE',
  MIN(c."date"),
  MAX(c."date"),
  now(),
  now()
FROM "Commission" c
JOIN "Program" p ON p."companyId" = c."companyId"
GROUP BY p."id", c."companyId", c."partnerId"
ON CONFLICT ("programId", "partnerId") DO NOTHING;
