/*
  Warnings:

  - You are about to drop the `Outlet` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Menu" DROP CONSTRAINT "Menu_outletId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_outletId_fkey";

-- DropForeignKey
ALTER TABLE "Outlet" DROP CONSTRAINT "Outlet_emiratesId_fkey";

-- DropForeignKey
ALTER TABLE "OutletCuisine" DROP CONSTRAINT "OutletCuisine_outletId_fkey";

-- DropIndex
DROP INDEX "AdditionalPrice_name_key";

-- AlterTable
ALTER TABLE "AdditionalPrice" ADD COLUMN     "outletId" INTEGER;

-- DropTable
DROP TABLE "Outlet";

-- CreateTable
CREATE TABLE "outlets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emiratesId" INTEGER NOT NULL,
    "whatsappNo" TEXT NOT NULL,
    "status" "OutletStatus" NOT NULL,
    "exactLocation" JSONB NOT NULL DEFAULT '{"lat": 0.0, "lng": 0.0}',
    "operatingHours" JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "00:00"}',

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_emiratesId_fkey" FOREIGN KEY ("emiratesId") REFERENCES "Emirates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutletCuisine" ADD CONSTRAINT "OutletCuisine_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalPrice" ADD CONSTRAINT "AdditionalPrice_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
