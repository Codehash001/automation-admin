-- CreateTable
CREATE TABLE "DriverEmirate" (
    "driverId" INTEGER NOT NULL,
    "emirateId" INTEGER NOT NULL,

    CONSTRAINT "DriverEmirate_pkey" PRIMARY KEY ("driverId","emirateId")
);

-- AddForeignKey
ALTER TABLE "DriverEmirate" ADD CONSTRAINT "DriverEmirate_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverEmirate" ADD CONSTRAINT "DriverEmirate_emirateId_fkey" FOREIGN KEY ("emirateId") REFERENCES "Emirates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
