-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoicePriceMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

-- CreateEnum
CREATE TYPE "LineDiscountType" AS ENUM ('NONE', 'PERCENT', 'AMOUNT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'INVOICE_FINALIZED';
ALTER TYPE "StockMovementType" ADD VALUE 'INVOICE_CANCELLED';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "invoiceId" UUID;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "financialYear" CHAR(7) NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" VARCHAR(40),
    "sequenceNumber" INTEGER,
    "financialYear" CHAR(7) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE,
    "customerId" UUID,
    "placeOfSupplyState" VARCHAR(80) NOT NULL,
    "placeOfSupplyStateCode" CHAR(2) NOT NULL,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "priceMode" "InvoicePriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "notes" VARCHAR(2000),
    "terms" VARCHAR(2000),
    "sellerBusinessName" VARCHAR(160) NOT NULL,
    "sellerLegalName" VARCHAR(160),
    "sellerGstin" VARCHAR(15),
    "sellerPan" VARCHAR(10),
    "sellerAddressLine1" VARCHAR(200) NOT NULL,
    "sellerAddressLine2" VARCHAR(200),
    "sellerCity" VARCHAR(80) NOT NULL,
    "sellerState" VARCHAR(80) NOT NULL,
    "sellerStateCode" CHAR(2) NOT NULL,
    "sellerPincode" CHAR(6) NOT NULL,
    "sellerBankName" VARCHAR(120),
    "sellerAccountHolder" VARCHAR(160),
    "sellerAccountNumber" VARCHAR(34),
    "sellerIfsc" CHAR(11),
    "sellerUpiId" VARCHAR(100),
    "customerCodeSnapshot" VARCHAR(20),
    "customerNameSnapshot" VARCHAR(160) NOT NULL,
    "customerBusinessName" VARCHAR(160),
    "customerGstinSnapshot" VARCHAR(15),
    "customerPanSnapshot" VARCHAR(10),
    "customerPhoneSnapshot" VARCHAR(16),
    "customerEmailSnapshot" VARCHAR(254),
    "billingAddressLine1" VARCHAR(200) NOT NULL,
    "billingAddressLine2" VARCHAR(200),
    "billingCity" VARCHAR(80) NOT NULL,
    "billingState" VARCHAR(80) NOT NULL,
    "billingStateCode" CHAR(2) NOT NULL,
    "billingPincode" CHAR(6) NOT NULL,
    "shippingAddressLine1" VARCHAR(200),
    "shippingAddressLine2" VARCHAR(200),
    "shippingCity" VARCHAR(80),
    "shippingState" VARCHAR(80),
    "shippingStateCode" CHAR(2),
    "shippingPincode" VARCHAR(6),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancellationReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "productId" UUID,
    "lineNumber" INTEGER NOT NULL,
    "productCodeSnapshot" VARCHAR(20),
    "productNameSnapshot" VARCHAR(160) NOT NULL,
    "productTypeSnapshot" "ItemType" NOT NULL,
    "hsnSacCodeSnapshot" VARCHAR(8),
    "unitSnapshot" "ItemUnit" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "priceMode" "InvoicePriceMode" NOT NULL,
    "discountType" "LineDiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_businessId_financialYear_key" ON "InvoiceSequence"("businessId", "financialYear");

-- CreateIndex
CREATE INDEX "Invoice_businessId_status_invoiceDate_idx" ON "Invoice"("businessId", "status", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_businessId_customerId_idx" ON "Invoice"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");

-- CreateIndex
CREATE INDEX "Invoice_finalizedById_idx" ON "Invoice"("finalizedById");

-- CreateIndex
CREATE INDEX "Invoice_cancelledById_idx" ON "Invoice"("cancelledById");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_businessId_key" ON "Invoice"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_invoiceNumber_key" ON "Invoice"("businessId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_businessId_productId_idx" ON "InvoiceLine"("businessId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_lineNumber_key" ON "InvoiceLine"("invoiceId", "lineNumber");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_invoiceId_idx" ON "StockMovement"("businessId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_businessId_key" ON "Customer"("id", "businessId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_businessId_fkey" FOREIGN KEY ("invoiceId", "businessId") REFERENCES "Invoice"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_businessId_fkey" FOREIGN KEY ("customerId", "businessId") REFERENCES "Customer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_businessId_fkey" FOREIGN KEY ("invoiceId", "businessId") REFERENCES "Invoice"("id", "businessId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_businessId_fkey" FOREIGN KEY ("productId", "businessId") REFERENCES "Product"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;
