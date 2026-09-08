-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "ItemUnit" AS ENUM ('PCS', 'NOS', 'KG', 'G', 'LTR', 'ML', 'MTR', 'BOX', 'PACK', 'SET', 'HOUR', 'DAY', 'SERVICE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "nextProductNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameKey" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "productCode" VARCHAR(20) NOT NULL,
    "type" "ItemType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "categoryId" UUID,
    "sku" VARCHAR(80),
    "barcode" VARCHAR(100),
    "hsnSacCode" VARCHAR(8),
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "unit" "ItemUnit" NOT NULL,
    "purchasePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(15,2),
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "openingStock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "currentStock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "minimumStock" DECIMAL(18,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "beforeStock" DECIMAL(18,3) NOT NULL,
    "afterStock" DECIMAL(18,3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_businessId_isActive_name_idx" ON "Category"("businessId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_businessId_key" ON "Category"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_nameKey_key" ON "Category"("businessId", "nameKey");

-- CreateIndex
CREATE INDEX "Product_businessId_isActive_type_idx" ON "Product"("businessId", "isActive", "type");

-- CreateIndex
CREATE INDEX "Product_businessId_name_idx" ON "Product"("businessId", "name");

-- CreateIndex
CREATE INDEX "Product_businessId_categoryId_idx" ON "Product"("businessId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_businessId_key" ON "Product"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_productCode_key" ON "Product"("businessId", "productCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_barcode_key" ON "Product"("businessId", "barcode");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_productId_createdAt_idx" ON "StockMovement"("businessId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdById_idx" ON "StockMovement"("createdById");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_businessId_fkey" FOREIGN KEY ("categoryId", "businessId") REFERENCES "Category"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_businessId_fkey" FOREIGN KEY ("productId", "businessId") REFERENCES "Product"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
