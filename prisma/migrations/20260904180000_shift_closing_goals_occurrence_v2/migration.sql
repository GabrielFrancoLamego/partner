-- CreateEnum
CREATE TYPE "OccurrencePaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'TRABALHO', 'FOLGA_ADICIONAL');

-- CreateEnum
CREATE TYPE "OccurrencePaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "ShiftClosingStatus" AS ENUM ('PENDING_GERENTE', 'PENDING_MASTER', 'COMPLETED');

-- AlterEnum
-- Hand-written (not `prisma migrate dev`, which refuses non-interactive data-loss
-- confirmations): maps every existing OccurrenceType row to its closest new value
-- instead of a blind ::text cast, which would error on rows using retired values.
BEGIN;
CREATE TYPE "OccurrenceType_new" AS ENUM ('FOLGA_FERIADO', 'VALE', 'CONSUMO', 'META', 'FALTA', 'ATESTADO', 'ADVERTENCIA', 'SUSPENSAO', 'DIARIA', 'HORA_EXTRA', 'BANCO_HORAS', 'DISPENSADO', 'FIXADO');
ALTER TABLE "Occurrence" ALTER COLUMN "type" TYPE "OccurrenceType_new" USING (
  CASE "type"::text
    WHEN 'WARNING' THEN 'ADVERTENCIA'
    WHEN 'SALARY_ADVANCE' THEN 'VALE'
    WHEN 'CASH_SHORTAGE' THEN 'CONSUMO'
    WHEN 'SUSPENSION' THEN 'SUSPENSAO'
    WHEN 'DAY_OFF' THEN 'FOLGA_FERIADO'
    WHEN 'HOLIDAY_PAY' THEN 'FOLGA_FERIADO'
    WHEN 'SUNDAY_WORKED_PAY' THEN 'HORA_EXTRA'
    WHEN 'SUNDAY_DAY_OFF' THEN 'FOLGA_FERIADO'
    ELSE "type"::text
  END
)::"OccurrenceType_new";
ALTER TYPE "OccurrenceType" RENAME TO "OccurrenceType_old";
ALTER TYPE "OccurrenceType_new" RENAME TO "OccurrenceType";
DROP TYPE "public"."OccurrenceType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Occurrence" DROP CONSTRAINT "Occurrence_employeeId_fkey";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "shiftClosingDeadline" TEXT NOT NULL DEFAULT '22:00';

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "canRegisterOccurrences" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastXpSeenAt" TIMESTAMP(3),
ADD COLUMN     "monthlySalary" DECIMAL(10,2);

-- AlterTable
-- Rewritten from the raw `prisma migrate diff` output to preserve existing data:
-- copies amount -> value and documentUrl -> attachmentUrl before dropping the
-- old columns, and backfills `total` for existing rows instead of leaving it null.
ALTER TABLE "Occurrence" ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "discountWaived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "employeeNameFreeText" TEXT,
ADD COLUMN     "paymentMethod" "OccurrencePaymentMethod",
ADD COLUMN     "paymentStatus" "OccurrencePaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "quantity" DECIMAL(6,2) NOT NULL DEFAULT 1,
ADD COLUMN     "total" DECIMAL(10,2),
ADD COLUMN     "value" DECIMAL(10,2),
ALTER COLUMN "employeeId" DROP NOT NULL;

UPDATE "Occurrence" SET "value" = "amount" WHERE "amount" IS NOT NULL;
UPDATE "Occurrence" SET "attachmentUrl" = "documentUrl" WHERE "documentUrl" IS NOT NULL;
UPDATE "Occurrence" SET "total" = "value" * "quantity" WHERE "value" IS NOT NULL;

ALTER TABLE "Occurrence" DROP COLUMN "amount",
DROP COLUMN "documentUrl";

-- CreateTable
CREATE TABLE "ShiftClosing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "revenueAmount" DECIMAL(10,2),
    "receiptUrl" TEXT,
    "summary" TEXT,
    "status" "ShiftClosingStatus" NOT NULL DEFAULT 'PENDING_GERENTE',
    "isMasterOverride" BOOLEAN NOT NULL DEFAULT false,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueGoalTier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetAmount" DECIMAL(10,2) NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueGoalTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftClosing_companyId_idx" ON "ShiftClosing"("companyId");

-- CreateIndex
CREATE INDEX "ShiftClosing_status_idx" ON "ShiftClosing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftClosing_companyId_date_key" ON "ShiftClosing"("companyId", "date");

-- CreateIndex
CREATE INDEX "RevenueGoalTier_companyId_idx" ON "RevenueGoalTier"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueGoalTier_companyId_order_key" ON "RevenueGoalTier"("companyId", "order");

-- AddForeignKey
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClosing" ADD CONSTRAINT "ShiftClosing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClosing" ADD CONSTRAINT "ShiftClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueGoalTier" ADD CONSTRAINT "RevenueGoalTier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
