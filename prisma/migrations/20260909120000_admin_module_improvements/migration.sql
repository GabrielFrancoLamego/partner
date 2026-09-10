-- CreateEnum
CREATE TYPE "CommissionFormat" AS ENUM ('PERCENTAGE', 'FIXED_VALUE', 'PRODUCT_UNIT');

-- CreateEnum
CREATE TYPE "PromotionOfferType" AS ENUM ('DISCOUNT', 'FREE_GIFT', 'DOUBLE_BENEFIT');

-- CreateEnum
CREATE TYPE "AffiliatePayoutType" AS ENUM ('SIGNUP_BONUS', 'MILESTONE_BONUS');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('PENDING', 'PAID');

-- DropForeignKey
ALTER TABLE "PublicRegistrationRequest" DROP CONSTRAINT "PublicRegistrationRequest_companyId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "operatingShift1End" TEXT,
ADD COLUMN     "operatingShift1Start" TEXT,
ADD COLUMN     "operatingShift2End" TEXT,
ADD COLUMN     "operatingShift2Start" TEXT;

-- AlterTable
ALTER TABLE "License" ADD COLUMN     "billingDay" INTEGER,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartnerProfile" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "affiliateMilestoneAt" TIMESTAMP(3);

-- AlterTable: adiciona as colunas novas primeiro (sem derrubar isPercentage
-- ainda) para poder migrar o dado existente antes de perdê-lo.
ALTER TABLE "Program" ADD COLUMN     "commissionFormat" "CommissionFormat" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "productUnitLabel" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- Backfill: preserva o valor histórico de isPercentage antes de remover a coluna.
UPDATE "Program" SET "commissionFormat" = CASE WHEN "isPercentage" THEN 'PERCENTAGE'::"CommissionFormat" ELSE 'FIXED_VALUE'::"CommissionFormat" END;

-- AlterTable
ALTER TABLE "Program" DROP COLUMN "isPercentage";

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "discountPercentage" DECIMAL(5,2),
ADD COLUMN     "discountedPrice" DECIMAL(10,2),
ADD COLUMN     "offerType" "PromotionOfferType" NOT NULL DEFAULT 'DISCOUNT',
ADD COLUMN     "originalPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "PublicRegistrationRequest" ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
ALTER COLUMN "linkId" DROP NOT NULL,
ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bonusPerPartner" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "milestoneClientCount" INTEGER NOT NULL DEFAULT 10,
    "milestoneBonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pixKey" TEXT,
    "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "partnerId" TEXT,
    "type" "AffiliatePayoutType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_userId_idx" ON "AccessLog"("userId");

-- CreateIndex
CREATE INDEX "AccessLog_companyId_idx" ON "AccessLog"("companyId");

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_email_key" ON "Affiliate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_active_idx" ON "Affiliate"("active");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_idx" ON "AffiliatePayout"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_partnerId_idx" ON "AffiliatePayout"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerProfile_affiliateId_idx" ON "PartnerProfile"("affiliateId");

-- CreateIndex
CREATE INDEX "PublicRegistrationRequest_affiliateId_idx" ON "PublicRegistrationRequest"("affiliateId");

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistrationRequest" ADD CONSTRAINT "PublicRegistrationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistrationRequest" ADD CONSTRAINT "PublicRegistrationRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
