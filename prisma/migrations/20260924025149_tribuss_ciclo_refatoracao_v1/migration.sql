-- CreateEnum
CREATE TYPE "OccurrenceImpactKind" AS ENUM ('POINTS', 'SALARY', 'HOURS_BANK', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "OccurrenceSalaryImpactType" AS ENUM ('DISCOUNT', 'BONUS');

-- CreateEnum
CREATE TYPE "PromotionAudience" AS ENUM ('EXTERNAL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PromotionVoucherStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TIMECLOCK_ADJUSTED';
ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_OFFERED';

-- AlterEnum
ALTER TYPE "OccurrenceType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "dailyBreakAllowanceMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "pendingPromotionLevelId" TEXT,
ADD COLUMN     "pendingPromotionOfferedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InternalLevelRule" ADD COLUMN     "minTenureMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InternalProgram" ADD COLUMN     "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "pointsLatePenalty" INTEGER NOT NULL DEFAULT -5;

-- AlterTable
ALTER TABLE "Occurrence" ADD COLUMN     "customTypeId" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "audience" "PromotionAudience" NOT NULL DEFAULT 'EXTERNAL';

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "adjustedAt" TIMESTAMP(3),
ADD COLUMN     "adjustedById" TEXT,
ADD COLUMN     "adjustmentNote" TEXT,
ADD COLUMN     "isManagerAdjusted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PromotionVoucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "channel" TEXT,
    "status" "PromotionVoucherStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "redeemedCommissionId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccurrenceTypeConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OccurrenceImpactKind" NOT NULL,
    "pointsImpact" INTEGER,
    "salaryImpactType" "OccurrenceSalaryImpactType",
    "salaryImpactValue" DECIMAL(10,2),
    "hoursBankImpactMinutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccurrenceTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionVoucher_code_key" ON "PromotionVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionVoucher_redeemedCommissionId_key" ON "PromotionVoucher"("redeemedCommissionId");

-- CreateIndex
CREATE INDEX "PromotionVoucher_companyId_idx" ON "PromotionVoucher"("companyId");

-- CreateIndex
CREATE INDEX "PromotionVoucher_promotionId_idx" ON "PromotionVoucher"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionVoucher_status_idx" ON "PromotionVoucher"("status");

-- CreateIndex
CREATE INDEX "PostReaction_postId_idx" ON "PostReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "OccurrenceTypeConfig_companyId_idx" ON "OccurrenceTypeConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OccurrenceTypeConfig_companyId_name_key" ON "OccurrenceTypeConfig"("companyId", "name");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_pendingPromotionLevelId_fkey" FOREIGN KEY ("pendingPromotionLevelId") REFERENCES "InternalLevelRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVoucher" ADD CONSTRAINT "PromotionVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVoucher" ADD CONSTRAINT "PromotionVoucher_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVoucher" ADD CONSTRAINT "PromotionVoucher_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVoucher" ADD CONSTRAINT "PromotionVoucher_redeemedCommissionId_fkey" FOREIGN KEY ("redeemedCommissionId") REFERENCES "Commission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "OccurrenceTypeConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceTypeConfig" ADD CONSTRAINT "OccurrenceTypeConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccurrenceTypeConfig" ADD CONSTRAINT "OccurrenceTypeConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
