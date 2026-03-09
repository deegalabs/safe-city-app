-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('bar', 'pharmacy', 'store', 'other');

-- AlterTable
ALTER TABLE "partners" ADD COLUMN "type" "PartnerType" NOT NULL DEFAULT 'other',
ADD COLUMN "open_time" TEXT,
ADD COLUMN "close_time" TEXT,
ADD COLUMN "open_days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
