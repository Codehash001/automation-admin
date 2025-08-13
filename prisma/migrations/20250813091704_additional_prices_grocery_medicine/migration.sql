-- AlterTable
ALTER TABLE "AdditionalPrice" ADD COLUMN     "groceryStoreId" INTEGER,
ADD COLUMN     "medicalStoreId" INTEGER;

-- CreateIndex
CREATE INDEX "AdditionalPrice_groceryStoreId_idx" ON "AdditionalPrice"("groceryStoreId");

-- CreateIndex
CREATE INDEX "AdditionalPrice_medicalStoreId_idx" ON "AdditionalPrice"("medicalStoreId");

-- AddForeignKey
ALTER TABLE "AdditionalPrice" ADD CONSTRAINT "AdditionalPrice_groceryStoreId_fkey" FOREIGN KEY ("groceryStoreId") REFERENCES "GroceryStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalPrice" ADD CONSTRAINT "AdditionalPrice_medicalStoreId_fkey" FOREIGN KEY ("medicalStoreId") REFERENCES "MedicalStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
