-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "rideVehicleTypeRefId" INTEGER;

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" SERIAL NOT NULL,
    "category" "RideServiceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_category_name_key" ON "VehicleType"("category", "name");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_rideVehicleTypeRefId_fkey" FOREIGN KEY ("rideVehicleTypeRefId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
