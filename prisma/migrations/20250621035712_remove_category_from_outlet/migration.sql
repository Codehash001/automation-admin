/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Outlet` table. All the data in the column will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Outlet" DROP CONSTRAINT "Outlet_categoryId_fkey";

-- AlterTable
ALTER TABLE "Outlet" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE "Category";
