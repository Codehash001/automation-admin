-- CreateTable
CREATE TABLE "AppointmentType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentPlace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "appointmentTypeId" INTEGER NOT NULL,
    "specialistName" TEXT,
    "whatsappNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "exactLocation" JSONB NOT NULL DEFAULT '{"lat": 0.0, "lng": 0.0}',
    "address" TEXT NOT NULL,
    "numberOfAppointedPeople" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "appointmentPlaceId" INTEGER NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentType_name_key" ON "AppointmentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentPlace_appointmentTypeId_name_key" ON "AppointmentPlace"("appointmentTypeId", "name");

-- AddForeignKey
ALTER TABLE "AppointmentPlace" ADD CONSTRAINT "AppointmentPlace_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_appointmentPlaceId_fkey" FOREIGN KEY ("appointmentPlaceId") REFERENCES "AppointmentPlace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
