-- CreateTable
CREATE TABLE "RiderDeliveryMapping" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "deliveryId" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderDeliveryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderDeliveryMapping_phone_key" ON "RiderDeliveryMapping"("phone");

-- AddForeignKey
ALTER TABLE "RiderDeliveryMapping" ADD CONSTRAINT "RiderDeliveryMapping_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
