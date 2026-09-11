-- Phase 10 POS Billing metadata only.
-- POS sales reuse finalized Invoice records and existing payment/stock ledgers.
CREATE TYPE "InvoiceSalesChannel" AS ENUM ('STANDARD', 'POS');

ALTER TABLE "Invoice"
  ADD COLUMN "salesChannel" "InvoiceSalesChannel" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "posClientCheckoutId" UUID;

CREATE UNIQUE INDEX "Invoice_businessId_posClientCheckoutId_key" ON "Invoice"("businessId", "posClientCheckoutId");
CREATE INDEX "Invoice_businessId_salesChannel_status_invoiceDate_idx" ON "Invoice"("businessId", "salesChannel", "status", "invoiceDate");
