ALTER TABLE "ScheduleEntry"
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "endTime" TEXT;

UPDATE "ScheduleEntry"
SET
  "startTime" = CASE "slotKey"
    WHEN '09:30' THEN '09:30'
    WHEN '10:30' THEN '10:30'
    WHEN '11:30' THEN '11:30'
    WHEN '13:30' THEN '13:30'
    WHEN '14:30' THEN '14:30'
    WHEN '15:30' THEN '15:30'
    WHEN '16:30' THEN '16:30'
    WHEN '17:30' THEN '17:30'
    ELSE '09:30'
  END,
  "endTime" = CASE "slotKey"
    WHEN '09:30' THEN '10:30'
    WHEN '10:30' THEN '11:30'
    WHEN '11:30' THEN '12:30'
    WHEN '13:30' THEN '14:30'
    WHEN '14:30' THEN '15:30'
    WHEN '15:30' THEN '16:30'
    WHEN '16:30' THEN '17:30'
    WHEN '17:30' THEN '18:30'
    ELSE '10:30'
  END;

ALTER TABLE "ScheduleEntry"
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL;

DROP INDEX "ScheduleEntry_userId_dayOfWeek_slotKey_key";

ALTER TABLE "ScheduleEntry"
DROP COLUMN "slotKey";

CREATE INDEX "ScheduleEntry_userId_dayOfWeek_startTime_idx" ON "ScheduleEntry"("userId", "dayOfWeek", "startTime");
