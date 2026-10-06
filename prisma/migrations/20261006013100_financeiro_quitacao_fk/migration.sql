-- AddForeignKey
ALTER TABLE "FinancialSettlement" ADD CONSTRAINT "FinancialSettlement_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
