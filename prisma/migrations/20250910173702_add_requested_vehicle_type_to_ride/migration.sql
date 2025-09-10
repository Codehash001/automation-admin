-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "requestedVehicleTypeRefId" INTEGER;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_requestedVehicleTypeRefId_fkey" FOREIGN KEY ("requestedVehicleTypeRefId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
