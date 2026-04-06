-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_updatedAt_idx" ON "ScheduleEntry"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_userId_dayOfWeek_slotKey_key" ON "ScheduleEntry"("userId", "dayOfWeek", "slotKey");
