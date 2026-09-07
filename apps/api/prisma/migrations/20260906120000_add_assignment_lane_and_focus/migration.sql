-- Stores the timeline's manual vertical priority and optional focused sub-range.
-- Existing assignments remain unchanged because all new fields are nullable.
ALTER TABLE "Assignment" ADD COLUMN "laneIndex" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN "focusStart" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN "focusEnd" TIMESTAMP(3);

CREATE INDEX "Assignment_userId_laneIndex_idx" ON "Assignment"("userId", "laneIndex");
