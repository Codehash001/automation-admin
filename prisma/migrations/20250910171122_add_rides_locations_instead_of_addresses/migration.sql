/*
  Warnings:

  - You are about to drop the column `dropoffAddress` on the `RideRequest` table. All the data in the column will be lost.
  - You are about to drop the column `pickupAddress` on the `RideRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RideRequest" DROP COLUMN "dropoffAddress",
DROP COLUMN "pickupAddress",
ADD COLUMN     "dropoffLocation" TEXT,
ADD COLUMN     "pickupLocation" TEXT;
