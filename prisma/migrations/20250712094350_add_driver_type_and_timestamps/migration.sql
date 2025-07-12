/*
  Warnings:

  - Added the required column `updatedAt` to the `Driver` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('DELIVERY', 'RIDE_SERVICE');

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "driverType" "DriverType" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
