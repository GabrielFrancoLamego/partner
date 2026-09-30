-- CreateEnum
CREATE TYPE "TimeclockAdjustmentKind" AS ENUM ('LATE_CHECKIN', 'CHECKOUT_VARIANCE', 'BREAK_OVERAGE');

-- AlterEnum
ALTER TYPE "OccurrencePaymentMethod" ADD VALUE 'CONSUMO';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consumptionDebt" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TimeclockAdjustmentReview" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "TimeclockAdjustmentKind" NOT NULL,
    "computedMinutes" INTEGER NOT NULL,
    "computedPoints" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "justification" TEXT,
    "reviewedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeclockAdjustmentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeclockAdjustmentReview_companyId_idx" ON "TimeclockAdjustmentReview"("companyId");

-- CreateIndex
CREATE INDEX "TimeclockAdjustmentReview_employeeId_idx" ON "TimeclockAdjustmentReview"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeclockAdjustmentReview_employeeId_date_kind_key" ON "TimeclockAdjustmentReview"("employeeId", "date", "kind");

-- AddForeignKey
ALTER TABLE "TimeclockAdjustmentReview" ADD CONSTRAINT "TimeclockAdjustmentReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeclockAdjustmentReview" ADD CONSTRAINT "TimeclockAdjustmentReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeclockAdjustmentReview" ADD CONSTRAINT "TimeclockAdjustmentReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
