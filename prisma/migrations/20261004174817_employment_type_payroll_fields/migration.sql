-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FIXO', 'TEMPORARIO', 'DIARISTA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OccurrenceType" ADD VALUE 'SALARIO';
ALTER TYPE "OccurrenceType" ADD VALUE 'TAXA_SERVICO';
ALTER TYPE "OccurrenceType" ADD VALUE 'COMPRA_DOMINGO';

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FIXO';

-- AlterTable
ALTER TABLE "GoalPayout" ADD COLUMN     "expectedPaymentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Occurrence" ADD COLUMN     "expectedPaymentDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OccurrenceTypeConfig" ADD COLUMN     "isTax" BOOLEAN NOT NULL DEFAULT false;
