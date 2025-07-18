/*
  Warnings:

  - You are about to drop the column `categoryId` on the `GroceryMenu` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `MedicineMenu` table. All the data in the column will be lost.
  - You are about to drop the `GroceryCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroceryStoreCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MedicalStoreCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MedicineCategory` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[storeId,name]` on the table `GroceryMenu` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storeId,name]` on the table `MedicineMenu` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "GroceryMenu" DROP CONSTRAINT "GroceryMenu_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "GroceryStoreCategory" DROP CONSTRAINT "GroceryStoreCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "GroceryStoreCategory" DROP CONSTRAINT "GroceryStoreCategory_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MedicalStoreCategory" DROP CONSTRAINT "MedicalStoreCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "MedicalStoreCategory" DROP CONSTRAINT "MedicalStoreCategory_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MedicineMenu" DROP CONSTRAINT "MedicineMenu_categoryId_fkey";

-- DropIndex
DROP INDEX "GroceryMenu_storeId_categoryId_name_key";

-- DropIndex
DROP INDEX "MedicineMenu_storeId_categoryId_name_key";

-- AlterTable
ALTER TABLE "GroceryMenu" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "MedicineMenu" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "GroceryCategory";

-- DropTable
DROP TABLE "GroceryStoreCategory";

-- DropTable
DROP TABLE "MedicalStoreCategory";

-- DropTable
DROP TABLE "MedicineCategory";

-- CreateIndex
CREATE UNIQUE INDEX "GroceryMenu_storeId_name_key" ON "GroceryMenu"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineMenu_storeId_name_key" ON "MedicineMenu"("storeId", "name");
