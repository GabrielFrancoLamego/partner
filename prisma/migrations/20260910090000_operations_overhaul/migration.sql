-- CreateEnum
CREATE TYPE "AffiliateRewardType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "RegistrationLinkType" AS ENUM ('COMPANY_SIGNUP', 'EMPLOYEE_SIGNUP', 'PARTNER_GENERIC', 'PARTNER_FOR_COMPANY');

-- AlterEnum
ALTER TYPE "ChecklistRecurrence" ADD VALUE 'SEMIANNUAL';
ALTER TYPE "ChecklistRecurrence" ADD VALUE 'ANNUAL';

-- AlterEnum
ALTER TYPE "ChecklistStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "ChecklistStatus" ADD VALUE 'RETURNED';

-- DropForeignKey
ALTER TABLE "PublicRegistrationLink" DROP CONSTRAINT "PublicRegistrationLink_companyId_fkey";

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "bonusPercentage" DECIMAL(5,2),
ADD COLUMN     "partnerProfileId" TEXT,
ADD COLUMN     "rewardType" "AffiliateRewardType" NOT NULL DEFAULT 'FIXED';

-- AlterTable: forDate entra nullable primeiro para poder ser preenchida a
-- partir de createdAt nas linhas já existentes, só depois vira NOT NULL.
ALTER TABLE "Checklist" ADD COLUMN     "forDate" TIMESTAMP(3),
ADD COLUMN     "isAutoReassigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "photoUrl" DROP NOT NULL;

UPDATE "Checklist" SET "forDate" = date_trunc('day', "createdAt") WHERE "forDate" IS NULL;

ALTER TABLE "Checklist" ALTER COLUMN "forDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "primaryEmployeeId" TEXT,
ADD COLUMN     "recurrenceDayOfMonth" INTEGER,
ADD COLUMN     "recurrenceDayOfWeek" INTEGER,
ADD COLUMN     "requiresPhoto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "secondaryEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "exemptionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "exemptionMonths" INTEGER;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PublicRegistrationLink" ADD COLUMN     "exemptionMonths" INTEGER,
ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "sectorId" TEXT,
ADD COLUMN     "type" "RegistrationLinkType" NOT NULL DEFAULT 'EMPLOYEE_SIGNUP',
ALTER COLUMN "companyId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PublicRegistrationRequest" ADD COLUMN     "sectorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_partnerProfileId_key" ON "Affiliate"("partnerProfileId");

-- CreateIndex
CREATE INDEX "Checklist_forDate_idx" ON "Checklist"("forDate");

-- CreateIndex
CREATE INDEX "PublicRegistrationLink_type_idx" ON "PublicRegistrationLink"("type");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_primaryEmployeeId_fkey" FOREIGN KEY ("primaryEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_secondaryEmployeeId_fkey" FOREIGN KEY ("secondaryEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistrationLink" ADD CONSTRAINT "PublicRegistrationLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistrationLink" ADD CONSTRAINT "PublicRegistrationLink_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistrationRequest" ADD CONSTRAINT "PublicRegistrationRequest_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_partnerProfileId_fkey" FOREIGN KEY ("partnerProfileId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
