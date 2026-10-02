-- CreateEnum
CREATE TYPE "ChecklistAssignmentType" AS ENUM ('SPECIFIC', 'FREE', 'SECTOR', 'TAG');

-- DropForeignKey
ALTER TABLE "Checklist" DROP CONSTRAINT "Checklist_employeeId_fkey";

-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "targetSectorId" TEXT,
ADD COLUMN     "targetTag" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "assignmentType" "ChecklistAssignmentType" NOT NULL DEFAULT 'SPECIFIC',
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "targetSectorId" TEXT,
ADD COLUMN     "targetTag" TEXT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "tag" TEXT;

-- AlterTable
ALTER TABLE "Occurrence" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "paymentProofUrl" TEXT;

-- CreateIndex
CREATE INDEX "Checklist_targetSectorId_idx" ON "Checklist"("targetSectorId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_targetSectorId_idx" ON "ChecklistTemplate"("targetSectorId");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_targetSectorId_fkey" FOREIGN KEY ("targetSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_targetSectorId_fkey" FOREIGN KEY ("targetSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occurrence" ADD CONSTRAINT "Occurrence_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
