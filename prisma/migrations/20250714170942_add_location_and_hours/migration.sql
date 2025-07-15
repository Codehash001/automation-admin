-- AlterTable
ALTER TABLE "Outlet" ADD COLUMN     "exactLocation" JSONB NOT NULL DEFAULT '{"lat": 0.0, "lng": 0.0}',
ADD COLUMN     "operatingHours" JSONB NOT NULL DEFAULT '{"open": "00:00", "close": "00:00"}';
