-- CreateEnum
CREATE TYPE "MeasurementPeriod" AS ENUM ('MONTHLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "GoalScope" AS ENUM ('COMPANY', 'SECTOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('DAILY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- DropForeignKey
ALTER TABLE "CareerLevel" DROP CONSTRAINT "CareerLevel_companyId_fkey";

-- DropForeignKey
ALTER TABLE "RevenueGoalTier" DROP CONSTRAINT "RevenueGoalTier_companyId_fkey";

-- DropIndex
DROP INDEX "Program_companyId_idx";

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "bankOfHoursMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "breakEndTime" TEXT,
ADD COLUMN     "breakStartTime" TEXT,
ADD COLUMN     "currentInternalLevelId" TEXT,
ADD COLUMN     "sectorId" TEXT,
ADD COLUMN     "shiftType" "ShiftType",
ADD COLUMN     "workEndTime" TEXT,
ADD COLUMN     "workStartTime" TEXT;

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "termsContent" TEXT;

-- DropTable
DROP TABLE "CareerLevel";

-- DropTable
DROP TABLE "RevenueGoalTier";

-- CreateTable
CREATE TABLE "InternalProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pdfUrl" TEXT,
    "termsContent" TEXT,
    "measurementPeriod" "MeasurementPeriod" NOT NULL DEFAULT 'MONTHLY',
    "pointsOnTimeCheckIn" INTEGER NOT NULL DEFAULT 5,
    "pointsChecklistOnTime" INTEGER NOT NULL DEFAULT 5,
    "pointsChecklistLateOrRejected" INTEGER NOT NULL DEFAULT -3,
    "pointsOccurrencePenalty" INTEGER NOT NULL DEFAULT -10,
    "minEfficiencyPercent" INTEGER NOT NULL DEFAULT 90,
    "efficiencyBonusAmount" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalLevelRule" (
    "id" TEXT NOT NULL,
    "internalProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pointsRequired" INTEGER NOT NULL,
    "salaryIncreasePercent" DECIMAL(5,2),
    "imageUrl" TEXT,
    "bonusDescription" TEXT,
    "bonusAmount" DECIMAL(10,2),
    "badgeColorHex" TEXT NOT NULL DEFAULT '#F58220',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalLevelRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTermAcceptance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "internalProgramId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "EmployeeTermAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTermAcceptance" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "PartnerTermAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scope" "GoalScope" NOT NULL,
    "sectorId" TEXT,
    "employeeId" TEXT,
    "period" "GoalPeriod" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalTier" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetAmount" DECIMAL(10,2) NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalRecord" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receiptUrl" TEXT,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalProgram_companyId_key" ON "InternalProgram"("companyId");

-- CreateIndex
CREATE INDEX "InternalLevelRule_internalProgramId_idx" ON "InternalLevelRule"("internalProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalLevelRule_internalProgramId_order_key" ON "InternalLevelRule"("internalProgramId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTermAcceptance_employeeId_internalProgramId_key" ON "EmployeeTermAcceptance"("employeeId", "internalProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTermAcceptance_partnerId_programId_key" ON "PartnerTermAcceptance"("partnerId", "programId");

-- CreateIndex
CREATE INDEX "Sector_companyId_idx" ON "Sector"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_companyId_name_key" ON "Sector"("companyId", "name");

-- CreateIndex
CREATE INDEX "Goal_companyId_idx" ON "Goal"("companyId");

-- CreateIndex
CREATE INDEX "Goal_sectorId_idx" ON "Goal"("sectorId");

-- CreateIndex
CREATE INDEX "Goal_employeeId_idx" ON "Goal"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalTier_goalId_order_key" ON "GoalTier"("goalId", "order");

-- CreateIndex
CREATE INDEX "GoalRecord_goalId_idx" ON "GoalRecord"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalRecord_goalId_date_key" ON "GoalRecord"("goalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Program_companyId_key" ON "Program"("companyId");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_currentInternalLevelId_fkey" FOREIGN KEY ("currentInternalLevelId") REFERENCES "InternalLevelRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalProgram" ADD CONSTRAINT "InternalProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalLevelRule" ADD CONSTRAINT "InternalLevelRule_internalProgramId_fkey" FOREIGN KEY ("internalProgramId") REFERENCES "InternalProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTermAcceptance" ADD CONSTRAINT "EmployeeTermAcceptance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTermAcceptance" ADD CONSTRAINT "EmployeeTermAcceptance_internalProgramId_fkey" FOREIGN KEY ("internalProgramId") REFERENCES "InternalProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTermAcceptance" ADD CONSTRAINT "PartnerTermAcceptance_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTermAcceptance" ADD CONSTRAINT "PartnerTermAcceptance_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTier" ADD CONSTRAINT "GoalTier_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalRecord" ADD CONSTRAINT "GoalRecord_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalRecord" ADD CONSTRAINT "GoalRecord_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

