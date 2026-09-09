-- CreateEnum
CREATE TYPE "BusinessDocumentType" AS ENUM ('QUOTATION', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'SALES_RETURN', 'PURCHASE_ORDER', 'PURCHASE_BILL', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "BusinessDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'CONFIRMED', 'FINALIZED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE_BILL_FINALIZED';
ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE_BILL_CANCELLED';
ALTER TYPE "StockMovementType" ADD VALUE 'SALES_RETURN_FINALIZED';
ALTER TYPE "StockMovementType" ADD VALUE 'SALES_RETURN_CANCELLED';
ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE_RETURN_FINALIZED';
ALTER TYPE "StockMovementType" ADD VALUE 'PURCHASE_RETURN_CANCELLED';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "documentId" UUID;

-- CreateTable
CREATE TABLE "BusinessDocumentSequence" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "documentType" "BusinessDocumentType" NOT NULL,
    "financialYear" CHAR(7) NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDocument" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "documentType" "BusinessDocumentType" NOT NULL,
    "status" "BusinessDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "documentNumber" VARCHAR(40),
    "sequenceNumber" INTEGER,
    "financialYear" CHAR(7) NOT NULL,
    "documentDate" DATE NOT NULL,
    "dueDate" DATE,
    "validUntil" DATE,
    "partyKind" VARCHAR(10) NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "sourceInvoiceId" UUID,
    "sourceDocumentId" UUID,
    "supplierInvoiceNumber" VARCHAR(80),
    "placeOfSupplyState" VARCHAR(80) NOT NULL,
    "placeOfSupplyStateCode" CHAR(2) NOT NULL,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
    "priceMode" "InvoicePriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "reason" VARCHAR(500),
    "notes" VARCHAR(2000),
    "terms" VARCHAR(2000),
    "businessNameSnapshot" VARCHAR(160) NOT NULL,
    "businessGstinSnapshot" VARCHAR(15),
    "businessAddressLine1" VARCHAR(200) NOT NULL,
    "businessCity" VARCHAR(80) NOT NULL,
    "businessState" VARCHAR(80) NOT NULL,
    "businessStateCode" CHAR(2) NOT NULL,
    "businessPincode" VARCHAR(6) NOT NULL,
    "partyCodeSnapshot" VARCHAR(20),
    "partyNameSnapshot" VARCHAR(160) NOT NULL,
    "partyBusinessName" VARCHAR(160),
    "partyGstinSnapshot" VARCHAR(15),
    "partyPanSnapshot" VARCHAR(10),
    "partyPhoneSnapshot" VARCHAR(16),
    "partyEmailSnapshot" VARCHAR(254),
    "partyAddressLine1" VARCHAR(200) NOT NULL,
    "partyCity" VARCHAR(80) NOT NULL,
    "partyState" VARCHAR(80) NOT NULL,
    "partyStateCode" CHAR(2) NOT NULL,
    "partyPincode" VARCHAR(6) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxableTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "actedAt" TIMESTAMP(3),
    "actedById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancellationReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDocumentLine" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "productId" UUID,
    "sourceInvoiceLineId" UUID,
    "sourceDocumentLineId" UUID,
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

    CONSTRAINT "BusinessDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocumentSequence_businessId_documentType_financialY_key" ON "BusinessDocumentSequence"("businessId", "documentType", "financialYear");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_documentType_status_documentDat_idx" ON "BusinessDocument"("businessId", "documentType", "status", "documentDate");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_customerId_idx" ON "BusinessDocument"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_supplierId_idx" ON "BusinessDocument"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_sourceInvoiceId_idx" ON "BusinessDocument"("businessId", "sourceInvoiceId");

-- CreateIndex
CREATE INDEX "BusinessDocument_businessId_sourceDocumentId_idx" ON "BusinessDocument"("businessId", "sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_id_businessId_key" ON "BusinessDocument"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_businessId_documentNumber_key" ON "BusinessDocument"("businessId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDocument_businessId_supplierId_supplierInvoiceNumbe_key" ON "BusinessDocument"("businessId", "supplierId", "supplierInvoiceNumber");

-- CreateIndex
CREATE INDEX "BusinessDocumentLine_businessId_productId_idx" ON "BusinessDocumentLine"("businessId", "productId");

-- CreateIndex
CREATE INDEX "BusinessDocumentLine_businessId_sourceInvoiceLineId_idx" ON "BusinessDocumentLine"("businessId", "sourceInvoiceLineId");

-- CreateIndex
CREATE INDEX "BusinessDocumentLine_businessId_sourceDocumentLineId_idx" ON "BusinessDocumentLine"("businessId", "sourceDocumentLineId");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_documentId_idx" ON "StockMovement"("businessId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_businessId_key" ON "Supplier"("id", "businessId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_documentId_businessId_fkey" FOREIGN KEY ("documentId", "businessId") REFERENCES "BusinessDocument"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocumentSequence" ADD CONSTRAINT "BusinessDocumentSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_customerId_businessId_fkey" FOREIGN KEY ("customerId", "businessId") REFERENCES "Customer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_supplierId_businessId_fkey" FOREIGN KEY ("supplierId", "businessId") REFERENCES "Supplier"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocumentLine" ADD CONSTRAINT "BusinessDocumentLine_documentId_businessId_fkey" FOREIGN KEY ("documentId", "businessId") REFERENCES "BusinessDocument"("id", "businessId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDocumentLine" ADD CONSTRAINT "BusinessDocumentLine_productId_businessId_fkey" FOREIGN KEY ("productId", "businessId") REFERENCES "Product"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

