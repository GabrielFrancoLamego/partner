-- CreateEnum
CREATE TYPE "GoalRewardType" AS ENUM ('CASH', 'PHYSICAL_REWARD');

-- CreateEnum
CREATE TYPE "GoalPayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "InternalMessageRecipientType" AS ENUM ('SECTOR', 'ROLE', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "InternalMessageStatus" AS ENUM ('SENT', 'PENDING_RESPONSE', 'RESPONDED', 'CONCLUDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'COMMISSION_EARNED';
ALTER TYPE "NotificationType" ADD VALUE 'BONUS_AWARDED';
ALTER TYPE "NotificationType" ADD VALUE 'INTERNAL_MESSAGE_RECEIVED';

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "hasExtraMonthlyDayOff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFinanceResponsible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSectorCommunicationResponsible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyDayOff" INTEGER,
ADD COLUMN     "weeklySchedule" JSONB;

-- AlterTable
ALTER TABLE "GoalTier" ADD COLUMN     "rewardCatalogItemId" TEXT,
ADD COLUMN     "rewardLabel" TEXT,
ADD COLUMN     "rewardType" "GoalRewardType" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "ProgramLevel" ADD COLUMN     "commissionFixedAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyViaEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyViaPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyViaWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soundOnEarnings" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MonthlyDayOffRecord" (
    "id" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedDate" TIMESTAMP(3),
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyDayOffRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientType" "InternalMessageRecipientType" NOT NULL,
    "recipientSectorId" TEXT,
    "recipientRole" "Role",
    "recipientEmployeeId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrls" TEXT[],
    "status" "InternalMessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessageReply" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalMessageReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalPayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalTierId" TEXT,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "rewardType" "GoalRewardType" NOT NULL DEFAULT 'CASH',
    "status" "GoalPayoutStatus" NOT NULL DEFAULT 'PAID',
    "paidById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyDayOffRecord_companyId_idx" ON "MonthlyDayOffRecord"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyDayOffRecord_employeeProfileId_month_key" ON "MonthlyDayOffRecord"("employeeProfileId", "month");

-- CreateIndex
CREATE INDEX "InternalMessage_companyId_idx" ON "InternalMessage"("companyId");

-- CreateIndex
CREATE INDEX "InternalMessage_senderId_idx" ON "InternalMessage"("senderId");

-- CreateIndex
CREATE INDEX "InternalMessage_status_idx" ON "InternalMessage"("status");

-- CreateIndex
CREATE INDEX "InternalMessageReply_messageId_idx" ON "InternalMessageReply"("messageId");

-- CreateIndex
CREATE INDEX "GoalPayout_companyId_idx" ON "GoalPayout"("companyId");

-- CreateIndex
CREATE INDEX "GoalPayout_employeeId_idx" ON "GoalPayout"("employeeId");

-- CreateIndex
CREATE INDEX "GoalPayout_goalId_idx" ON "GoalPayout"("goalId");

-- AddForeignKey
ALTER TABLE "GoalTier" ADD CONSTRAINT "GoalTier_rewardCatalogItemId_fkey" FOREIGN KEY ("rewardCatalogItemId") REFERENCES "RewardCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyDayOffRecord" ADD CONSTRAINT "MonthlyDayOffRecord_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyDayOffRecord" ADD CONSTRAINT "MonthlyDayOffRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_recipientSectorId_fkey" FOREIGN KEY ("recipientSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageReply" ADD CONSTRAINT "InternalMessageReply_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InternalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageReply" ADD CONSTRAINT "InternalMessageReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_goalTierId_fkey" FOREIGN KEY ("goalTierId") REFERENCES "GoalTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
