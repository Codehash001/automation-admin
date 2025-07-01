/*
  Warnings:

  - You are about to drop the column `cuisineId` on the `Outlet` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[outletId,cuisineId,name]` on the table `Menu` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Menu` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MenuItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Outlet" DROP CONSTRAINT "Outlet_cuisineId_fkey";

-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cuisineId" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Outlet" DROP COLUMN "cuisineId";

-- CreateTable
CREATE TABLE "OutletCuisine" (
    "outletId" INTEGER NOT NULL,
    "cuisineId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletCuisine_pkey" PRIMARY KEY ("outletId","cuisineId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Menu_outletId_cuisineId_name_key" ON "Menu"("outletId", "cuisineId", "name");

-- AddForeignKey
ALTER TABLE "OutletCuisine" ADD CONSTRAINT "OutletCuisine_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletCuisine" ADD CONSTRAINT "OutletCuisine_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
