-- DropForeignKey
ALTER TABLE "AdditionalPrice" DROP CONSTRAINT "AdditionalPrice_outletId_fkey";

-- AlterTable
ALTER TABLE "AdditionalPrice" ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "value" SET DEFAULT 0,
ALTER COLUMN "type" SET DEFAULT 'fixed';

-- AlterTable
ALTER TABLE "outlets" ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "whatsappNo" SET DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'CLOSED';

-- CreateIndex
CREATE INDEX "AdditionalPrice_outletId_idx" ON "AdditionalPrice"("outletId");

-- AddForeignKey
ALTER TABLE "AdditionalPrice" ADD CONSTRAINT "AdditionalPrice_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
