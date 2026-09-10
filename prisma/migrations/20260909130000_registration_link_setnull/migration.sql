-- DropForeignKey
ALTER TABLE "PublicRegistrationRequest" DROP CONSTRAINT "PublicRegistrationRequest_linkId_fkey";

-- AddForeignKey
ALTER TABLE "PublicRegistrationRequest" ADD CONSTRAINT "PublicRegistrationRequest_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PublicRegistrationLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
