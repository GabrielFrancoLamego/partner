-- AlterTable
ALTER TABLE "GoalPayout" ADD COLUMN     "occurrenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GoalPayout_occurrenceId_key" ON "GoalPayout"("occurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalPayout_goalId_goalTierId_employeeId_period_key" ON "GoalPayout"("goalId", "goalTierId", "employeeId", "period");

-- AddForeignKey
ALTER TABLE "GoalPayout" ADD CONSTRAINT "GoalPayout_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
