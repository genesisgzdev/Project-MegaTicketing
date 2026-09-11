-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED');

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "publishingToken" TEXT;

-- CreateTable
CREATE TABLE "ProcessedOrderEvent" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reservationCreatedAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "refundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_refundId_key" ON "PaymentAttempt"("refundId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_seatId_reservationCreatedAt_idx" ON "PaymentAttempt"("seatId", "reservationCreatedAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");


-- Preserve existing payment bindings before any reservation can be reused.
INSERT INTO "PaymentAttempt" ("id", "eventId", "seatId", "userId", "ticketId", "reservationCreatedAt", "amountMinor", "currency", "status", "refundId")
SELECT t."paymentIntentId", s."eventId", t."seatId", t."userId", t."id", t."createdAt", t."paymentAmountMinor", t."paymentCurrency",
  (CASE WHEN t."refundId" IS NOT NULL THEN 'REFUNDED' WHEN t."status" = 'PAID' THEN 'PAID' WHEN t."status" = 'CANCELLED' THEN 'REFUND_PENDING' ELSE 'PENDING' END)::"PaymentAttemptStatus", t."refundId"
FROM "Ticket" t JOIN "Seat" s ON s."id" = t."seatId"
WHERE t."paymentIntentId" IS NOT NULL AND t."paymentAmountMinor" IS NOT NULL AND t."paymentCurrency" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
