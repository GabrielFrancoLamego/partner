-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinnedMobileNavItems" TEXT[] DEFAULT ARRAY[]::TEXT[];
