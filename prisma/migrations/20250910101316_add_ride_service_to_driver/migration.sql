-- CreateEnum
CREATE TYPE "RideServiceCategory" AS ENUM ('TRADITIONAL_TAXI', 'LIMOUSINE');

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "rideServiceCategory" "RideServiceCategory",
ADD COLUMN     "rideVehicleCapacity" INTEGER,
ADD COLUMN     "rideVehicleType" TEXT;
