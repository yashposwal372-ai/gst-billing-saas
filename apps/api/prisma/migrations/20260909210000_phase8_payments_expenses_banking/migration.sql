-- CreateEnum
CREATE TYPE "MoneyAccountType" AS ENUM ('CASH', 'BANK', 'UPI', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountEntryType" AS ENUM ('OPENING_BALANCE', 'CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'PAYMENT_REVERSAL', 'EXPENSE_REVERSAL', 'TRANSFER_REVERSAL');

-- CreateEnum
CREATE TYPE "AccountEntryDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceSequenceType" AS ENUM ('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('POSTED', 'REVERSED');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "nextAccountNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "accountCode" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "MoneyAccountType" NOT NULL,
    "bankName" VARCHAR(120),
    "accountNumberLast4" CHAR(4),
    "ifsc" CHAR(11),
    "upiId" VARCHAR(100),
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyAccountEntry" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "type" "AccountEntryType" NOT NULL,
    "direction" "AccountEntryDirection" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "balanceBefore" DECIMAL(15,2) NOT NULL,
    "balanceAfter" DECIMAL(15,2) NOT NULL,
    "paymentId" UUID,
    "expenseId" UUID,
    "transferId" UUID,
    "referenceType" VARCHAR(40),
    "referenceId" VARCHAR(80),
    "description" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyAccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSequence" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "type" "FinanceSequenceType" NOT NULL,
    "financialYear" CHAR(7) NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "paymentNumber" VARCHAR(40),
    "sequenceNumber" INTEGER,
    "financialYear" CHAR(7) NOT NULL,
    "type" "PaymentType" NOT NULL,
    "customerId" UUID,
    "supplierId" UUID,
    "accountId" UUID NOT NULL,
    "paymentDate" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceNumber" VARCHAR(120),
    "amount" DECIMAL(15,2) NOT NULL,
    "notes" VARCHAR(2000),
    "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "postedById" UUID,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID,
    "documentId" UUID,
    "amount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nameKey" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "expenseNumber" VARCHAR(40),
    "sequenceNumber" INTEGER,
    "financialYear" CHAR(7) NOT NULL,
    "categoryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "supplierId" UUID,
    "expenseDate" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceNumber" VARCHAR(120),
    "notes" VARCHAR(2000),
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "postedById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancellationReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "transferNumber" VARCHAR(40) NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "financialYear" CHAR(7) NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "transferDate" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "referenceNumber" VARCHAR(120),
    "notes" VARCHAR(2000),
    "status" "TransferStatus" NOT NULL DEFAULT 'POSTED',
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyAccount_businessId_isActive_type_idx" ON "MoneyAccount"("businessId", "isActive", "type");

-- CreateIndex
CREATE INDEX "MoneyAccount_businessId_name_idx" ON "MoneyAccount"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_id_businessId_key" ON "MoneyAccount"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_businessId_accountCode_key" ON "MoneyAccount"("businessId", "accountCode");

-- CreateIndex
CREATE INDEX "MoneyAccountEntry_businessId_accountId_createdAt_idx" ON "MoneyAccountEntry"("businessId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MoneyAccountEntry_businessId_paymentId_idx" ON "MoneyAccountEntry"("businessId", "paymentId");

-- CreateIndex
CREATE INDEX "MoneyAccountEntry_businessId_expenseId_idx" ON "MoneyAccountEntry"("businessId", "expenseId");

-- CreateIndex
CREATE INDEX "MoneyAccountEntry_businessId_transferId_idx" ON "MoneyAccountEntry"("businessId", "transferId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSequence_businessId_type_financialYear_key" ON "FinanceSequence"("businessId", "type", "financialYear");

-- CreateIndex
CREATE INDEX "Payment_businessId_type_status_paymentDate_idx" ON "Payment"("businessId", "type", "status", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_businessId_customerId_idx" ON "Payment"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "Payment_businessId_supplierId_idx" ON "Payment"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "Payment_businessId_accountId_idx" ON "Payment"("businessId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_businessId_key" ON "Payment"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_businessId_paymentNumber_key" ON "Payment"("businessId", "paymentNumber");

-- CreateIndex
CREATE INDEX "PaymentAllocation_businessId_paymentId_idx" ON "PaymentAllocation"("businessId", "paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_businessId_invoiceId_idx" ON "PaymentAllocation"("businessId", "invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_businessId_documentId_idx" ON "PaymentAllocation"("businessId", "documentId");

-- CreateIndex
CREATE INDEX "ExpenseCategory_businessId_isActive_name_idx" ON "ExpenseCategory"("businessId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_id_businessId_key" ON "ExpenseCategory"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_businessId_nameKey_key" ON "ExpenseCategory"("businessId", "nameKey");

-- CreateIndex
CREATE INDEX "Expense_businessId_status_expenseDate_idx" ON "Expense"("businessId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_businessId_categoryId_idx" ON "Expense"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "Expense_businessId_accountId_idx" ON "Expense"("businessId", "accountId");

-- CreateIndex
CREATE INDEX "Expense_businessId_supplierId_idx" ON "Expense"("businessId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_id_businessId_key" ON "Expense"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_businessId_expenseNumber_key" ON "Expense"("businessId", "expenseNumber");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_status_transferDate_idx" ON "AccountTransfer"("businessId", "status", "transferDate");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_fromAccountId_idx" ON "AccountTransfer"("businessId", "fromAccountId");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_toAccountId_idx" ON "AccountTransfer"("businessId", "toAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_id_businessId_key" ON "AccountTransfer"("id", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_businessId_transferNumber_key" ON "AccountTransfer"("businessId", "transferNumber");

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_accountId_businessId_fkey" FOREIGN KEY ("accountId", "businessId") REFERENCES "MoneyAccount"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_paymentId_businessId_fkey" FOREIGN KEY ("paymentId", "businessId") REFERENCES "Payment"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_expenseId_businessId_fkey" FOREIGN KEY ("expenseId", "businessId") REFERENCES "Expense"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_transferId_businessId_fkey" FOREIGN KEY ("transferId", "businessId") REFERENCES "AccountTransfer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccountEntry" ADD CONSTRAINT "MoneyAccountEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSequence" ADD CONSTRAINT "FinanceSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_businessId_fkey" FOREIGN KEY ("customerId", "businessId") REFERENCES "Customer"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_businessId_fkey" FOREIGN KEY ("supplierId", "businessId") REFERENCES "Supplier"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_businessId_fkey" FOREIGN KEY ("accountId", "businessId") REFERENCES "MoneyAccount"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_businessId_fkey" FOREIGN KEY ("paymentId", "businessId") REFERENCES "Payment"("id", "businessId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_businessId_fkey" FOREIGN KEY ("invoiceId", "businessId") REFERENCES "Invoice"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_documentId_businessId_fkey" FOREIGN KEY ("documentId", "businessId") REFERENCES "BusinessDocument"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_businessId_fkey" FOREIGN KEY ("categoryId", "businessId") REFERENCES "ExpenseCategory"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_businessId_fkey" FOREIGN KEY ("accountId", "businessId") REFERENCES "MoneyAccount"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_businessId_fkey" FOREIGN KEY ("supplierId", "businessId") REFERENCES "Supplier"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_businessId_fkey" FOREIGN KEY ("fromAccountId", "businessId") REFERENCES "MoneyAccount"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_businessId_fkey" FOREIGN KEY ("toAccountId", "businessId") REFERENCES "MoneyAccount"("id", "businessId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_party_exactly_one_check" CHECK (("type" = 'CUSTOMER_RECEIPT' AND "customerId" IS NOT NULL AND "supplierId" IS NULL) OR ("type" = 'SUPPLIER_PAYMENT' AND "supplierId" IS NOT NULL AND "customerId" IS NULL));
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_target_exactly_one_check" CHECK ((("invoiceId" IS NOT NULL)::int + ("documentId" IS NOT NULL)::int) = 1);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_amount_positive_check" CHECK ("amount" > 0 AND "fromAccountId" <> "toAccountId");
