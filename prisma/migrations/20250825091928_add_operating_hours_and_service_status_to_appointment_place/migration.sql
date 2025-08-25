-- AlterTable
ALTER TABLE "AppointmentPlace" ADD COLUMN     "operatingHours" JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "00:00"}',
ADD COLUMN     "serviceStatus" "OutletStatus" NOT NULL DEFAULT 'CLOSED';
