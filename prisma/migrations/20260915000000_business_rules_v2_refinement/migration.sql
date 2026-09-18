-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OVERDUE', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION_PENDING', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'BILLING_OVERDUE', 'GENERIC');

-- CreateEnum
CREATE TYPE "AffiliateLinkTarget" AS ENUM ('COMPANY', 'PARTNER');

-- CreateEnum
CREATE TYPE "LevelCriteria" AS ENUM ('REFERRAL_COUNT', 'REVENUE', 'BOTH');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('PERCENTAGE', 'FIXED', 'BOTH');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('ALL_TIME', 'DAYS', 'MONTHS');

-- CreateEnum
CREATE TYPE "InternalServiceFeeTierType" AS ENUM ('PENALTY', 'BONUS');

-- AlterEnum
ALTER TYPE "CommissionType" ADD VALUE 'BOTH';

-- AlterEnum
ALTER TYPE "AffiliatePayoutType" ADD VALUE 'RECURRING_COMMISSION';

-- AlterEnum
ALTER TYPE "AffiliateRewardType" ADD VALUE 'PERCENTAGE_RECURRING';

-- AlterTable: Company.status muda de `Status` (ACTIVE/INACTIVE) para o novo
-- `CompanyStatus` (mais os estados OVERDUE/BLOCKED/ARCHIVED) SEM perder o
-- valor atual de cada linha — o gerador padrão do Prisma faria DROP+ADD com
-- default fixo, que apagaria quem já estivesse INACTIVE.
ALTER TABLE "Company" ADD COLUMN "status_new" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "Company" SET "status_new" = "status"::text::"CompanyStatus";
ALTER TABLE "Company" DROP COLUMN "status";
ALTER TABLE "Company" RENAME COLUMN "status_new" TO "status";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overdueSince" TIMESTAMP(3),
ADD COLUMN     "statusReason" TEXT;

-- AlterTable
ALTER TABLE "PartnerProfile" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "agency" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "currentLevelSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "currentInternalLevelSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "autoDowngrade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fixedValue" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ProgramLevel" ADD COLUMN     "benefitType" "BenefitType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "bonusFixedAmount" DECIMAL(10,2),
ADD COLUMN     "criteria" "LevelCriteria" NOT NULL DEFAULT 'REFERRAL_COUNT',
ADD COLUMN     "measurementUnit" "MeasurementUnit" NOT NULL DEFAULT 'ALL_TIME',
ADD COLUMN     "requiredRevenueAmount" DECIMAL(10,2),
ALTER COLUMN "periodMonths" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "recurringPercentage" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "AffiliatePayout" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "periodKey" TEXT;

-- AlterTable
ALTER TABLE "InternalProgram" ADD COLUMN     "basePoints" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "InternalLevelRule" ADD COLUMN     "benefitType" "BenefitType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "measurementUnit" "MeasurementUnit" NOT NULL DEFAULT 'ALL_TIME',
ADD COLUMN     "measurementValue" INTEGER;

-- CreateTable
CREATE TABLE "AffiliateMilestone" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLinkVisit" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "target" "AffiliateLinkTarget" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateLinkVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalServiceFeeTier" (
    "id" TEXT NOT NULL,
    "internalProgramId" TEXT NOT NULL,
    "type" "InternalServiceFeeTierType" NOT NULL,
    "thresholdPoints" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixedAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalServiceFeeTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffiliateMilestone_affiliateId_idx" ON "AffiliateMilestone"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateMilestone_affiliateId_order_key" ON "AffiliateMilestone"("affiliateId", "order");

-- CreateIndex
CREATE INDEX "AffiliateLinkVisit_affiliateId_idx" ON "AffiliateLinkVisit"("affiliateId");

-- CreateIndex
CREATE INDEX "InternalServiceFeeTier_internalProgramId_idx" ON "InternalServiceFeeTier"("internalProgramId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Company_affiliateId_idx" ON "Company"("affiliateId");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "AffiliatePayout_companyId_idx" ON "AffiliatePayout"("companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateMilestone" ADD CONSTRAINT "AffiliateMilestone_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLinkVisit" ADD CONSTRAINT "AffiliateLinkVisit_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalServiceFeeTier" ADD CONSTRAINT "InternalServiceFeeTier_internalProgramId_fkey" FOREIGN KEY ("internalProgramId") REFERENCES "InternalProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
