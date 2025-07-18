-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_outletId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "groceryStoreId" INTEGER,
ADD COLUMN     "medicalStoreId" INTEGER,
ALTER COLUMN "outletId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GroceryOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "groceryMenuItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "GroceryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "medicineMenuItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "prescriptionUrl" TEXT,

    CONSTRAINT "MedicineOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryStore" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emiratesId" INTEGER NOT NULL,
    "whatsappNo" TEXT NOT NULL,
    "status" "OutletStatus" NOT NULL,
    "exactLocation" JSONB NOT NULL DEFAULT '{"lat": 0.0, "lng": 0.0}',
    "operatingHours" JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "00:00"}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GroceryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryStoreCategory" (
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryStoreCategory_pkey" PRIMARY KEY ("storeId","categoryId")
);

-- CreateTable
CREATE TABLE "GroceryMenu" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryMenuItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "menuId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalStore" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emiratesId" INTEGER NOT NULL,
    "whatsappNo" TEXT NOT NULL,
    "status" "OutletStatus" NOT NULL,
    "exactLocation" JSONB NOT NULL DEFAULT '{"lat": 0.0, "lng": 0.0}',
    "operatingHours" JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "00:00"}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MedicineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalStoreCategory" (
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalStoreCategory_pkey" PRIMARY KEY ("storeId","categoryId")
);

-- CreateTable
CREATE TABLE "MedicineMenu" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storeId" INTEGER NOT NULL,
    "categoryId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineMenuItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
    "menuId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroceryCategory_name_key" ON "GroceryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryMenu_storeId_categoryId_name_key" ON "GroceryMenu"("storeId", "categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineCategory_name_key" ON "MedicineCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineMenu_storeId_categoryId_name_key" ON "MedicineMenu"("storeId", "categoryId", "name");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_groceryStoreId_fkey" FOREIGN KEY ("groceryStoreId") REFERENCES "GroceryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_groceryMenuItemId_fkey" FOREIGN KEY ("groceryMenuItemId") REFERENCES "GroceryMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineOrderItem" ADD CONSTRAINT "MedicineOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineOrderItem" ADD CONSTRAINT "MedicineOrderItem_medicineMenuItemId_fkey" FOREIGN KEY ("medicineMenuItemId") REFERENCES "MedicineMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryStore" ADD CONSTRAINT "GroceryStore_emiratesId_fkey" FOREIGN KEY ("emiratesId") REFERENCES "Emirates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryStoreCategory" ADD CONSTRAINT "GroceryStoreCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "GroceryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryStoreCategory" ADD CONSTRAINT "GroceryStoreCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryMenu" ADD CONSTRAINT "GroceryMenu_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "GroceryStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryMenu" ADD CONSTRAINT "GroceryMenu_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroceryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryMenuItem" ADD CONSTRAINT "GroceryMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "GroceryMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalStore" ADD CONSTRAINT "MedicalStore_emiratesId_fkey" FOREIGN KEY ("emiratesId") REFERENCES "Emirates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalStoreCategory" ADD CONSTRAINT "MedicalStoreCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MedicalStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalStoreCategory" ADD CONSTRAINT "MedicalStoreCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MedicineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineMenu" ADD CONSTRAINT "MedicineMenu_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "MedicalStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineMenu" ADD CONSTRAINT "MedicineMenu_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MedicineCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineMenuItem" ADD CONSTRAINT "MedicineMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "MedicineMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
