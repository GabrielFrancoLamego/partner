-- CreateEnum
CREATE TYPE "AccountDeletionStatus" AS ENUM ('NONE', 'ACCOUNT_DELETION_REQUESTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_DELETION_REQUESTED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountDeletionReason" TEXT,
ADD COLUMN     "accountDeletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "accountDeletionStatus" "AccountDeletionStatus" NOT NULL DEFAULT 'NONE';
