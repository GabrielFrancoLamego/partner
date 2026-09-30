-- Reverte campo redundante adicionado por engano: ProgramLevel já cobre
-- comissão combinada (% + R$ fixo) via benefitType=BOTH + commissionPercentage
-- + bonusFixedAmount, então commissionFixedAmount nunca chegou a ser usado.
ALTER TABLE "ProgramLevel" DROP COLUMN IF EXISTS "commissionFixedAmount";
