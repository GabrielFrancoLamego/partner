/*
  Warnings:

  - You are about to drop the column `redeemedCommissionId` on the `PromotionVoucher` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PromotionVoucher" DROP CONSTRAINT "PromotionVoucher_redeemedCommissionId_fkey";

-- DropIndex
DROP INDEX "PromotionVoucher_redeemedCommissionId_key";

-- AlterTable
ALTER TABLE "PromotionVoucher" DROP COLUMN "redeemedCommissionId",
ADD COLUMN     "redeemedAmount" DECIMAL(10,2),
ADD COLUMN     "redeemedAttachmentUrl" TEXT,
ADD COLUMN     "redeemedBillJustification" TEXT,
ADD COLUMN     "redeemedById" TEXT;

-- AddForeignKey
ALTER TABLE "PromotionVoucher" ADD CONSTRAINT "PromotionVoucher_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
