-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3);
