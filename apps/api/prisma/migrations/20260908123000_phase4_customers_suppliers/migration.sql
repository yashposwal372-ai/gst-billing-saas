-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "BalanceDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "nextCustomerNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextSupplierNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "businessName" VARCHAR(160),
    "contactPerson" VARCHAR(160),
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "phone" VARCHAR(16) NOT NULL,
    "whatsappNumber" VARCHAR(16),
    "email" VARCHAR(254),
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "stateCode" CHAR(2) NOT NULL,
    "pincode" CHAR(6) NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "BalanceDirection" NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerCode" VARCHAR(20) NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "shippingSameAsBilling" BOOLEAN NOT NULL DEFAULT true,
    "shippingAddressLine1" VARCHAR(200),
    "shippingAddressLine2" VARCHAR(200),
    "shippingCity" VARCHAR(80),
    "shippingState" VARCHAR(80),
    "shippingStateCode" CHAR(2),
    "shippingPincode" CHAR(6),
    "creditLimit" DECIMAL(15,2),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "businessName" VARCHAR(160),
    "contactPerson" VARCHAR(160),
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "phone" VARCHAR(16) NOT NULL,
    "whatsappNumber" VARCHAR(16),
    "email" VARCHAR(254),
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "stateCode" CHAR(2) NOT NULL,
    "pincode" CHAR(6) NOT NULL,
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "BalanceDirection" NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "notes" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supplierCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(120),
    "accountHolderName" VARCHAR(160),
    "accountNumber" VARCHAR(34),
    "ifsc" CHAR(11),
    "upiId" VARCHAR(100),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_businessId_isActive_createdAt_idx" ON "Customer"("businessId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_businessId_displayName_idx" ON "Customer"("businessId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_customerCode_key" ON "Customer"("businessId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_gstin_key" ON "Customer"("businessId", "gstin");

-- CreateIndex
CREATE INDEX "Supplier_businessId_isActive_createdAt_idx" ON "Supplier"("businessId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Supplier_businessId_displayName_idx" ON "Supplier"("businessId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_supplierCode_key" ON "Supplier"("businessId", "supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_gstin_key" ON "Supplier"("businessId", "gstin");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
