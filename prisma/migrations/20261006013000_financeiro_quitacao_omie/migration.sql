-- CreateEnum
CREATE TYPE "SettlementPaymentMethod" AS ENUM ('PIX', 'DINHEIRO', 'TRANSFERENCIA', 'CONSUMO');

-- CreateEnum
CREATE TYPE "SettlementSourceKind" AS ENUM ('WITHDRAWAL', 'OCCURRENCE', 'GOAL_PAYOUT', 'EMPLOYEE_NET');

-- AlterEnum
ALTER TYPE "OccurrencePaymentMethod" ADD VALUE 'TRANSFERENCIA';

-- AlterTable
ALTER TABLE "GoalPayout" ADD COLUMN     "omieCodigoLancamento" TEXT,
ADD COLUMN     "omieStatus" TEXT;

-- AlterTable
ALTER TABLE "Occurrence" ADD COLUMN     "omieCodigoLancamento" TEXT,
ADD COLUMN     "omieStatus" TEXT;

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "omieCodigoLancamento" TEXT,
ADD COLUMN     "omieStatus" TEXT;

-- CreateTable
CREATE TABLE "FinancialSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceKind" "SettlementSourceKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientDocument" TEXT,
    "pixKey" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paymentMethod" "SettlementPaymentMethod" NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "omieCodigoLancamento" TEXT,
    "omieStatus" TEXT,

    CONSTRAINT "FinancialSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialSettlement_companyId_paidAt_idx" ON "FinancialSettlement"("companyId", "paidAt");

-- CreateIndex
CREATE INDEX "FinancialSettlement_sourceKind_sourceId_idx" ON "FinancialSettlement"("sourceKind", "sourceId");

-- AddForeignKey
ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
