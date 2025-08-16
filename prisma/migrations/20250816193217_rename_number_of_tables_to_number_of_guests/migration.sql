/*
  Warnings:

  - Renaming column `numberOfTables` to `numberOfGuests` on the `Appointment` table to preserve existing data.

*/
-- AlterTable
ALTER TABLE "Appointment" RENAME COLUMN "numberOfTables" TO "numberOfGuests";
