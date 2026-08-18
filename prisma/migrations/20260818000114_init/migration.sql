-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT NOT NULL,
    "bodyStyle" TEXT NOT NULL,
    "exteriorColor" TEXT NOT NULL,
    "interiorColor" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "drivetrain" TEXT NOT NULL,
    "odometerKm" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL,
    "conditionGrade" DOUBLE PRECISION NOT NULL,
    "conditionReport" TEXT NOT NULL,
    "damageNotes" TEXT[],
    "titleStatus" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "sellingDealership" TEXT NOT NULL,
    "images" TEXT[],
    "auctionStart" TIMESTAMP(3) NOT NULL,
    "auctionEnd" TIMESTAMP(3) NOT NULL,
    "startingBid" INTEGER NOT NULL,
    "reservePrice" INTEGER,
    "buyNowPrice" INTEGER,
    "currentBid" INTEGER,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "soldAt" TIMESTAMP(3),
    "soldPrice" INTEGER,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "bidderId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_lot_key" ON "Vehicle"("lot");

-- CreateIndex
CREATE INDEX "Vehicle_make_idx" ON "Vehicle"("make");

-- CreateIndex
CREATE INDEX "Vehicle_bodyStyle_idx" ON "Vehicle"("bodyStyle");

-- CreateIndex
CREATE INDEX "Vehicle_province_idx" ON "Vehicle"("province");

-- CreateIndex
CREATE INDEX "Vehicle_auctionEnd_idx" ON "Vehicle"("auctionEnd");

-- CreateIndex
CREATE INDEX "Vehicle_conditionGrade_idx" ON "Vehicle"("conditionGrade");

-- CreateIndex
CREATE INDEX "Bid_vehicleId_createdAt_idx" ON "Bid"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_vehicleId_amount_key" ON "Bid"("vehicleId", "amount");

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
