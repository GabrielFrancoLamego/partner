-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OccurrenceType" ADD VALUE 'QUEBRA_CAIXA';
ALTER TYPE "OccurrenceType" ADD VALUE 'PAGAMENTO_CONSUMO';

-- AlterTable
ALTER TABLE "ShiftClosing" ADD COLUMN     "isLate" BOOLEAN NOT NULL DEFAULT false;
