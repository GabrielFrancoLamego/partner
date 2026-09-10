-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxEmployees" INTEGER NOT NULL,
    "maxPartners" INTEGER NOT NULL,
    "oneTimePrice" DECIMAL(10,2) NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- Seed dos 3 planos com os valores praticados hoje (mesmos defaults de lib/plans.ts)
INSERT INTO "Plan" ("id", "label", "maxEmployees", "maxPartners", "oneTimePrice", "monthlyPrice", "updatedAt") VALUES
  ('STANDARD', 'Standard', 5, 10, 300.00, 200.00, CURRENT_TIMESTAMP),
  ('PREMIUM', 'Premium', 30, 60, 700.00, 500.00, CURRENT_TIMESTAMP),
  ('ENTERPRISE', 'Enterprise', 50, 100, 1500.00, 1000.00, CURRENT_TIMESTAMP);
