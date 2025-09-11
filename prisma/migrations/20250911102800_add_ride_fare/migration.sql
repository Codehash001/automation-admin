-- CreateTable
CREATE TABLE "RideFare" (
    "id" SERIAL NOT NULL,
    "rideRequestId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "enteredByDriverId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideFare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RideFare_rideRequestId_key" ON "RideFare"("rideRequestId");

-- AddForeignKey
ALTER TABLE "RideFare" ADD CONSTRAINT "RideFare_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideFare" ADD CONSTRAINT "RideFare_enteredByDriverId_fkey" FOREIGN KEY ("enteredByDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
