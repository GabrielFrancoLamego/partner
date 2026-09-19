-- AlterEnum
ALTER TYPE "PromotionOfferType" ADD VALUE 'CASH_CREDIT';

-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'CHECKLIST_EXTRA_TASK';

-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "isExtraTask" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InternalProgram" ADD COLUMN     "pointsChecklistExtraTask" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "creditAmount" DECIMAL(10,2);
