-- CreateEnum
CREATE TYPE "MedalIcon" AS ENUM ('GOLD', 'SILVER', 'BRONZE', 'DIAMOND', 'CUSTOM');

-- AlterEnum
ALTER TYPE "MeasurementPeriod" ADD VALUE 'BIMONTHLY';

-- AlterTable: Commission ganha vínculo opcional com Program (indicação sem
-- Promotion, registrada no Scanner PDV) e justificativa de conta R$ 0,00.
ALTER TABLE "Commission" ADD COLUMN     "billJustification" TEXT,
ADD COLUMN     "programId" TEXT;

-- AlterTable
ALTER TABLE "InternalLevelRule" ADD COLUMN     "medalIcon" "MedalIcon" NOT NULL DEFAULT 'GOLD';

-- AlterTable
ALTER TABLE "ProgramLevel" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "medalIcon" "MedalIcon" NOT NULL DEFAULT 'GOLD';

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- InternalProgram: renomeia (preservando valores já configurados pelas
-- empresas) e divide pointsChecklistLateOrRejected em Atrasado/Reprovado,
-- além de adicionar as novas faixas de falta com/sem atestado.
-- ---------------------------------------------------------------------------
ALTER TABLE "InternalProgram" RENAME COLUMN "pointsOnTimeCheckIn" TO "pointsPunctualEntry";
ALTER TABLE "InternalProgram" RENAME COLUMN "pointsOccurrencePenalty" TO "pointsOccurrence";
ALTER TABLE "InternalProgram" RENAME COLUMN "pointsChecklistLateOrRejected" TO "pointsChecklistLate";
ALTER TABLE "InternalProgram" ADD COLUMN     "pointsChecklistFail" INTEGER NOT NULL DEFAULT -5;
ALTER TABLE "InternalProgram" ADD COLUMN     "pointsAbsenceJustified" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InternalProgram" ADD COLUMN     "pointsAbsenceUnjustified" INTEGER NOT NULL DEFAULT -15;

-- ---------------------------------------------------------------------------
-- InternalServiceFeeTier: de "1 threshold + type PENALTY/BONUS" para range
-- explícito [minPoints, maxPoints] com efeito assinado (negativo = redução).
-- Faixas existentes (thresholdPoints/type) são convertidas 1:1 antes de cair.
-- ---------------------------------------------------------------------------
ALTER TABLE "InternalServiceFeeTier" ADD COLUMN     "kind" "BenefitType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "InternalServiceFeeTier" ADD COLUMN     "minPoints" INTEGER;
ALTER TABLE "InternalServiceFeeTier" ADD COLUMN     "maxPoints" INTEGER;
ALTER TABLE "InternalServiceFeeTier" ALTER COLUMN "percentage" SET DATA TYPE DECIMAL(6,2);

UPDATE "InternalServiceFeeTier"
SET "minPoints" = 0,
    "maxPoints" = "thresholdPoints",
    "percentage" = CASE WHEN "percentage" IS NOT NULL THEN -ABS("percentage") ELSE NULL END,
    "fixedAmount" = CASE WHEN "fixedAmount" IS NOT NULL THEN -ABS("fixedAmount") ELSE NULL END,
    "kind" = CASE
      WHEN "percentage" IS NOT NULL AND "fixedAmount" IS NOT NULL THEN 'BOTH'::"BenefitType"
      WHEN "fixedAmount" IS NOT NULL THEN 'FIXED'::"BenefitType"
      ELSE 'PERCENTAGE'::"BenefitType"
    END
WHERE "type" = 'PENALTY';

UPDATE "InternalServiceFeeTier"
SET "minPoints" = "thresholdPoints",
    "maxPoints" = 999999,
    "percentage" = CASE WHEN "percentage" IS NOT NULL THEN ABS("percentage") ELSE NULL END,
    "fixedAmount" = CASE WHEN "fixedAmount" IS NOT NULL THEN ABS("fixedAmount") ELSE NULL END,
    "kind" = CASE
      WHEN "percentage" IS NOT NULL AND "fixedAmount" IS NOT NULL THEN 'BOTH'::"BenefitType"
      WHEN "fixedAmount" IS NOT NULL THEN 'FIXED'::"BenefitType"
      ELSE 'PERCENTAGE'::"BenefitType"
    END
WHERE "type" = 'BONUS';

ALTER TABLE "InternalServiceFeeTier" ALTER COLUMN "minPoints" SET NOT NULL;
ALTER TABLE "InternalServiceFeeTier" ALTER COLUMN "maxPoints" SET NOT NULL;
ALTER TABLE "InternalServiceFeeTier" DROP COLUMN "thresholdPoints";
ALTER TABLE "InternalServiceFeeTier" DROP COLUMN "type";

-- DropEnum
DROP TYPE "InternalServiceFeeTierType";
