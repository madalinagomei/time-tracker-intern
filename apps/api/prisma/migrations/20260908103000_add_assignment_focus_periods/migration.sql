-- Keep Assignment.focusStart/focusEnd during the transition.  Each complete
-- legacy range is copied exactly once when this migration is applied.
CREATE TABLE "AssignmentFocusPeriod" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentFocusPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentFocusPeriod_assignmentId_startDate_idx"
ON "AssignmentFocusPeriod"("assignmentId", "startDate");

ALTER TABLE "AssignmentFocusPeriod"
ADD CONSTRAINT "AssignmentFocusPeriod_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AssignmentFocusPeriod" ("id", "assignmentId", "startDate", "endDate")
SELECT
    'legacy-focus-' || "id",
    "id",
    "focusStart",
    "focusEnd"
FROM "Assignment"
WHERE "focusStart" IS NOT NULL
  AND "focusEnd" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
