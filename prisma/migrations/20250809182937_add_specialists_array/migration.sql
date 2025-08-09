/*
  Warnings:

  - You are about to drop the column `specialistName` on the `AppointmentPlace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AppointmentPlace" DROP COLUMN "specialistName",
ADD COLUMN     "specialistNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
