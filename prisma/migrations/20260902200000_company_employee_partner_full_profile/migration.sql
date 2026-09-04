-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "corporateName" TEXT,
ADD COLUMN     "coverPictureUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "logoWithLabelUrl" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profilePictureUrl" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "agency" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cnh" TEXT,
ADD COLUMN     "cnhCategory" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "cpfDocUrl" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "militaryCertificate" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "personalPhone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "proofOfResidenceUrl" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "rgDocUrl" TEXT,
ADD COLUMN     "rgIssuer" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "voterCard" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "PartnerProfile" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_cpf_key" ON "EmployeeProfile"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_nickname_key" ON "PartnerProfile"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_cpf_key" ON "PartnerProfile"("cpf");

