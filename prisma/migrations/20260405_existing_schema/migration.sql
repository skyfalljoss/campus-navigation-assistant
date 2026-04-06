-- CreateTable
CREATE TABLE "SavedLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecentSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "buildingId" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecentSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedLocation_userId_updatedAt_idx" ON "SavedLocation"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedLocation_userId_buildingId_key" ON "SavedLocation"("userId", "buildingId");

-- CreateIndex
CREATE INDEX "RecentSearch_userId_updatedAt_idx" ON "RecentSearch"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentSearch_userId_fingerprint_key" ON "RecentSearch"("userId", "fingerprint");

