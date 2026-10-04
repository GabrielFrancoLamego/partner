-- CreateEnum
CREATE TYPE "ChecklistRejectionKind" AS ENUM ('NOT_DELIVERED', 'FRAUD', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CompanyCalendarEventKind" AS ENUM ('HOLIDAY', 'CLOSED');

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "rejectionKind" "ChecklistRejectionKind";

-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "instructionPhotoUrl" TEXT,
ADD COLUMN     "instructionVideoUrl" TEXT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "militaryCertificateDocUrl" TEXT,
ADD COLUMN     "pis" TEXT,
ADD COLUMN     "pisDocUrl" TEXT,
ADD COLUMN     "voterCardDocUrl" TEXT;

-- AlterTable
ALTER TABLE "InternalProgram" ADD COLUMN     "pointsChecklistPartial" INTEGER NOT NULL DEFAULT -2;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "CompanyCalendarEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "CompanyCalendarEventKind" NOT NULL,
    "isPaidHoliday" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyCalendarEvent_companyId_idx" ON "CompanyCalendarEvent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCalendarEvent_companyId_date_key" ON "CompanyCalendarEvent"("companyId", "date");

-- AddForeignKey
ALTER TABLE "CompanyCalendarEvent" ADD CONSTRAINT "CompanyCalendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCalendarEvent" ADD CONSTRAINT "CompanyCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
