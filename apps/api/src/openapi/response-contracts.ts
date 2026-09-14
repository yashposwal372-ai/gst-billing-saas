// Explicit HTTP wire schemas for legacy serializers with erased/Record return types.
// These describe transport output, never ORM classes or domain entities.
import type { SchemaObject, ReferenceObject } from '@nestjs/swagger';
export type Schema = SchemaObject | ReferenceObject;
export const str: SchemaObject = { type: 'string' };
export const integer: SchemaObject = { type: 'integer' };
export const bool: SchemaObject = { type: 'boolean' };
export const uuid: SchemaObject = { type: 'string', format: 'uuid' };
export const date: SchemaObject = { type: 'string', format: 'date' };
export const timestamp: SchemaObject = { type: 'string', format: 'date-time' };
export const money: SchemaObject = {
  type: 'string',
  pattern: '^-?\\d+\\.\\d{2}$',
  description:
    'Exact decimal string, two fractional digits. Bookkeeping amounts are not verified external balances.',
};
export const quantity: SchemaObject = {
  type: 'string',
  pattern: '^-?\\d+\\.\\d{3}$',
};
export const nullable = (s: Schema): Schema =>
  '$ref' in s
    ? { anyOf: [s, { type: 'string', nullable: true, enum: [null] }] }
    : { ...s, nullable: true };
export const enumeration = (...values: string[]): SchemaObject => ({
  type: 'string',
  enum: values,
});
export const array = (items: Schema): SchemaObject => ({
  type: 'array',
  items,
});
export const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
});
export const fields = (names: string, schema: Schema): Record<string, Schema> =>
  Object.fromEntries(
    names
      .split(' ')
      .filter(Boolean)
      .map((n) => [n, schema]),
  );
export const ref = (name: string): ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});
export const profile = (schema: Schema): SchemaObject =>
  object({ profile: schema });
export const page = (schema: Schema): SchemaObject =>
  object({
    items: array(schema),
    page: integer,
    pageSize: integer,
    total: integer,
    totalPages: integer,
  });
const method = enumeration(
  'CASH',
  'BANK_TRANSFER',
  'UPI',
  'CARD',
  'CHEQUE',
  'OTHER',
);
const accountType = enumeration('CASH', 'BANK', 'UPI', 'OTHER');
const accountSummary = object({
  id: uuid,
  accountCode: str,
  name: str,
  type: accountType,
});
const paymentHistory = object(
  {
    paymentId: uuid,
    paymentNumber: nullable(str),
    paymentDate: nullable(date),
    amount: money,
    method,
    status: enumeration('DRAFT', 'POSTED', 'REVERSED'),
    account: nullable(accountSummary),
  },
  ['amount', 'account', 'paymentDate'],
);
const settlement = object({
  paymentStatus: enumeration('UNAVAILABLE', 'UNPAID', 'PARTIAL', 'PAID'),
  paidAmount: money,
  outstanding: money,
  paymentHistory: array(paymentHistory),
});
const totals = fields(
  'subtotal discountTotal taxableTotal cgstTotal sgstTotal igstTotal taxTotal roundOff grandTotal',
  money,
);
const line = object(
  {
    id: nullable(uuid),
    productId: nullable(uuid),
    lineNumber: integer,
    productCodeSnapshot: nullable(str),
    productNameSnapshot: str,
    productTypeSnapshot: enumeration('PRODUCT', 'SERVICE'),
    hsnSacCodeSnapshot: nullable(str),
    unitSnapshot: str,
    quantity,
    priceMode: enumeration('EXCLUSIVE', 'INCLUSIVE'),
    discountType: enumeration('NONE', 'PERCENT', 'AMOUNT'),
    ...fields(
      'unitPrice discountValue discountAmount grossAmount taxableAmount gstRate cgstRate cgstAmount sgstRate sgstAmount igstRate igstAmount taxAmount lineTotal',
      money,
    ),
  },
  [
    'productId',
    'lineNumber',
    'productNameSnapshot',
    'quantity',
    'unitPrice',
    'lineTotal',
  ],
);
const commercial = {
  id: nullable(uuid),
  sequenceNumber: nullable(integer),
  financialYear: str,
  priceMode: enumeration('EXCLUSIVE', 'INCLUSIVE'),
  placeOfSupplyState: str,
  placeOfSupplyStateCode: str,
  ...totals,
  lines: array(ref('CommercialLine')),
  ...fields('notes terms cancellationReason', nullable(str)),
  ...fields('createdAt updatedAt finalizedAt cancelledAt', nullable(date)),
  settlement: ref('Settlement'),
};
const invoice = object(
  {
    ...commercial,
    status: enumeration('DRAFT', 'FINALIZED', 'CANCELLED'),
    invoiceNumber: nullable(str),
    invoiceDate: date,
    dueDate: nullable(date),
    customerId: nullable(uuid),
    salesChannel: enumeration('STANDARD', 'POS'),
    posClientCheckoutId: nullable(uuid),
    ...fields(
      'customerNameSnapshot billingAddressLine1 billingCity billingState billingPincode sellerBusinessName sellerAddressLine1 sellerCity sellerState sellerPincode',
      str,
    ),
    ...fields(
      'customerCodeSnapshot customerGstinSnapshot sellerLegalName sellerGstin',
      nullable(str),
    ),
  },
  [
    'id',
    'status',
    'invoiceNumber',
    'invoiceDate',
    'financialYear',
    'priceMode',
    'lines',
    ...Object.keys(totals),
  ],
);
const document = object(
  {
    ...commercial,
    documentType: enumeration(
      'QUOTATION',
      'SALES_ORDER',
      'DELIVERY_CHALLAN',
      'SALES_RETURN',
      'PURCHASE_ORDER',
      'PURCHASE_BILL',
      'PURCHASE_RETURN',
    ),
    status: enumeration(
      'DRAFT',
      'ISSUED',
      'ACCEPTED',
      'REJECTED',
      'CONFIRMED',
      'FINALIZED',
      'CANCELLED',
    ),
    documentNumber: nullable(str),
    documentDate: date,
    dueDate: nullable(date),
    validUntil: nullable(date),
    ...fields(
      'customerId supplierId sourceInvoiceId sourceDocumentId',
      nullable(uuid),
    ),
    ...fields(
      'supplierInvoiceNumber partyCodeSnapshot partyGstinSnapshot businessGstinSnapshot reason',
      nullable(str),
    ),
    ...fields(
      'partyNameSnapshot partyAddressLine1 partyCity partyState partyPincode businessNameSnapshot businessAddressLine1 businessCity businessState businessPincode',
      str,
    ),
  },
  [
    'id',
    'documentType',
    'status',
    'documentNumber',
    'documentDate',
    'financialYear',
    'priceMode',
    'lines',
    ...Object.keys(totals),
  ],
);
const financeMeta = {
  id: uuid,
  businessId: uuid,
  createdById: uuid,
  createdAt: date,
  updatedAt: date,
};
const numbered = {
  ...financeMeta,
  sequenceNumber: nullable(integer),
  financialYear: str,
  ...fields('referenceNumber notes', nullable(str)),
};
const allocation = object({
  id: uuid,
  businessId: uuid,
  paymentId: uuid,
  invoiceId: nullable(uuid),
  documentId: nullable(uuid),
  amount: money,
  createdAt: date,
});
const payment = object(
  {
    ...numbered,
    paymentNumber: nullable(str),
    type: enumeration('CUSTOMER_RECEIPT', 'SUPPLIER_PAYMENT'),
    status: enumeration('DRAFT', 'POSTED', 'REVERSED'),
    customerId: nullable(uuid),
    supplierId: nullable(uuid),
    accountId: uuid,
    paymentDate: date,
    method,
    amount: money,
    allocations: array(ref('PaymentAllocation')),
  },
  [
    'id',
    'paymentNumber',
    'type',
    'status',
    'paymentDate',
    'method',
    'amount',
    'allocations',
  ],
);
const saleRow = object({
  invoiceId: uuid,
  invoiceNumber: nullable(str),
  invoiceDate: date,
  customerId: nullable(uuid),
  customerName: str,
  itemCount: integer,
  grandTotal: money,
  paidAmount: money,
  outstanding: money,
  paymentStatus: enumeration('UNPAID', 'PARTIAL', 'PAID'),
  salesChannel: enumeration('POS'),
});
const reportMoney = fields(
  'taxableValue cgst sgst igst totalTax grandTotal',
  money,
);
const reportRow = {
  ...reportMoney,
  placeOfSupply: str,
  placeOfSupplyStateCode: str,
  taxType: enumeration('INTER_STATE', 'INTRA_STATE'),
  gstinStatus: enumeration('GSTIN Recorded', 'No GSTIN Recorded'),
};
const reportScope = object({
  dateFrom: nullable(date),
  dateTo: nullable(date),
  financialYear: nullable(str),
  note: str,
});
const reportTotals = (value: string, count: string) =>
  object({
    ...fields('taxableValue cgst sgst igst totalTax', money),
    [value]: money,
    [count]: integer,
  });
const partyList = {
  id: uuid,
  displayName: str,
  businessName: nullable(str),
  phone: str,
  email: nullable(str),
  gstRegistered: bool,
  gstin: nullable(str),
  state: str,
  stateCode: str,
  openingBalance: money,
  openingBalanceType: enumeration('RECEIVABLE', 'PAYABLE'),
  isActive: bool,
  createdAt: timestamp,
  updatedAt: timestamp,
};
export const responseSchemas: Record<string, SchemaObject> = {
  CustomerListItem: object({ ...partyList, customerCode: str }),
  SupplierListItem: object({ ...partyList, supplierCode: str }),
  SafeUser: object({
    id: uuid,
    email: { type: 'string', format: 'email' },
    firstName: str,
    lastName: str,
    mobile: nullable(str),
    emailVerifiedAt: nullable(timestamp),
    currentBusinessId: nullable(uuid),
  }),
  CommercialLine: line,
  Invoice: invoice,
  BusinessDocument: document,
  Settlement: settlement,
  MoneyAccount: object({
    ...financeMeta,
    accountCode: str,
    name: str,
    type: accountType,
    ...fields('bankName accountNumberLast4 ifsc upiId', nullable(str)),
    openingBalance: money,
    currentBalance: money,
    isActive: bool,
  }),
  PaymentAllocation: allocation,
  Payment: payment,
  ExpenseCategory: object({
    ...financeMeta,
    name: str,
    nameKey: str,
    description: nullable(str),
    isActive: bool,
  }),
  Expense: object(
    {
      ...numbered,
      expenseNumber: nullable(str),
      categoryId: uuid,
      accountId: uuid,
      supplierId: nullable(uuid),
      expenseDate: date,
      description: str,
      amount: money,
      method,
      status: enumeration('DRAFT', 'POSTED', 'CANCELLED'),
    },
    [
      'id',
      'expenseNumber',
      'categoryId',
      'accountId',
      'expenseDate',
      'description',
      'amount',
      'method',
      'status',
    ],
  ),
  AccountTransfer: object(
    {
      ...numbered,
      transferNumber: str,
      fromAccountId: uuid,
      toAccountId: uuid,
      transferDate: date,
      amount: money,
      status: enumeration('POSTED', 'REVERSED'),
      fromAccount: accountSummary,
      toAccount: accountSummary,
    },
    [
      'id',
      'transferNumber',
      'fromAccountId',
      'toAccountId',
      'transferDate',
      'amount',
      'status',
    ],
  ),
  Receivable: object({
    invoice: object({ id: uuid, invoiceNumber: nullable(str) }),
    customer: object({ id: nullable(uuid), name: str }),
    invoiceDate: date,
    dueDate: nullable(date),
    grandTotal: money,
    paidAmount: money,
    outstanding: money,
    paymentStatus: enumeration('UNPAID', 'PARTIAL', 'PAID'),
    daysOverdue: integer,
  }),
  Payable: object({
    purchaseBill: object({ id: uuid, documentNumber: nullable(str) }),
    supplier: object({ id: nullable(uuid), name: str }),
    billDate: date,
    dueDate: nullable(date),
    grandTotal: money,
    paidAmount: money,
    outstanding: money,
    paymentStatus: enumeration('UNPAID', 'PARTIAL', 'PAID'),
    daysOverdue: integer,
  }),
  PosProduct: object({
    id: uuid,
    code: str,
    name: str,
    type: enumeration('PRODUCT', 'SERVICE'),
    unit: str,
    sku: nullable(str),
    barcode: nullable(str),
    salePrice: money,
    gstRate: money,
    currentStock: quantity,
    trackInventory: bool,
    stockStatus: enumeration(
      'SERVICE',
      'OUT_OF_STOCK',
      'LOW_STOCK',
      'IN_STOCK',
    ),
  }),
  PosSale: saleRow,
  PosCheckout: object({
    invoice: ref('Invoice'),
    payment: {
      description:
        'New checkout returns a serialized finance payment; duplicate checkout returns a recorded payment with native JSON decimal strings and ISO timestamps, without allocations. Null when not recorded.',
      nullable: true,
      anyOf: [
        ref('Payment'),
        object(
          {
            id: uuid,
            paymentNumber: nullable(str),
            amount: { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
            paymentDate: timestamp,
            status: enumeration('DRAFT', 'POSTED', 'REVERSED'),
            method,
          },
          ['id', 'paymentNumber', 'amount', 'paymentDate', 'status', 'method'],
        ),
      ],
    },
    paymentError: nullable(str),
    changeDue: money,
    duplicate: bool,
  }),
  SalesGstRow: object({
    ...reportRow,
    invoiceId: uuid,
    invoiceNumber: nullable(str),
    invoiceDate: date,
    customerId: nullable(uuid),
    customerName: str,
    customerGstin: nullable(str),
  }),
  PurchaseGstRow: object({
    ...reportRow,
    purchaseBillId: uuid,
    documentNumber: nullable(str),
    supplierInvoiceNumber: nullable(str),
    billDate: date,
    supplierId: nullable(uuid),
    supplierName: str,
    supplierGstin: nullable(str),
  }),
  GstRateRow: object(
    fields(
      'gstRate salesTaxableValue salesCgst salesSgst salesIgst salesTax purchaseTaxableValue purchaseCgst purchaseSgst purchaseIgst purchaseTax',
      money,
    ),
  ),
  HsnSacRow: object({
    classificationType: enumeration('HSN', 'SAC'),
    code: str,
    description: str,
    unit: str,
    gstRate: money,
    salesQuantity: quantity,
    purchaseQuantity: quantity,
    ...fields(
      'salesTaxableValue salesTaxAmount purchaseTaxableValue purchaseTaxAmount',
      money,
    ),
  }),
  GstSummary: object({
    scope: reportScope,
    outwardSales: reportTotals('invoiceValue', 'invoiceCount'),
    purchaseTaxRecorded: reportTotals('purchaseValue', 'billCount'),
    note: str,
  }),
  OutputTax: object({
    scope: reportScope,
    totals: reportTotals('invoiceValue', 'invoiceCount'),
    note: str,
  }),
  PurchaseTax: object({
    scope: reportScope,
    totals: reportTotals('purchaseValue', 'billCount'),
    note: str,
  }),
  OperationalReturns: object({
    note: str,
    salesReturns: reportTotals('total', 'count'),
    purchaseReturns: reportTotals('total', 'count'),
  }),
  LegacyError: object(
    { statusCode: integer, message: { oneOf: [str, array(str)] }, error: str },
    ['statusCode', 'message'],
  ),
  StandardError: {
    ...object(
      {
        code: str,
        message: str,
        requestId: str,
        details: {
          oneOf: [
            { type: 'object', additionalProperties: true },
            { type: 'array', items: {} },
          ],
        },
      },
      ['code', 'message'],
    ),
    description:
      'A03 framework-neutral future error envelope. Current global filter emits LegacyError; this is not a claim of runtime standardization. requestId is not currently propagated.',
  },
};

// The commercial/finance families have different lifecycle fields on the wire.
delete document.properties!.finalizedAt;
document.properties!.actedAt = nullable(date);
document.properties!.actedById = nullable(uuid);
document.properties!.lines = array(ref('BusinessDocumentLine'));
responseSchemas.BusinessDocumentLine = {
  ...line,
  properties: {
    ...line.properties,
    sourceInvoiceLineId: nullable(uuid),
    sourceDocumentLineId: nullable(uuid),
  },
};
Object.assign(payment.properties!, {
  postedAt: nullable(date),
  postedById: nullable(uuid),
  reversedAt: nullable(date),
  reversedById: nullable(uuid),
  reversalReason: nullable(str),
});
Object.assign(responseSchemas.Expense!.properties!, {
  postedAt: nullable(date),
  postedById: nullable(uuid),
  cancelledAt: nullable(date),
  cancelledById: nullable(uuid),
  cancellationReason: nullable(str),
});
Object.assign(responseSchemas.AccountTransfer!.properties!, {
  sequenceNumber: integer,
  reversedAt: nullable(date),
  reversedById: nullable(uuid),
  reversalReason: nullable(str),
});
const posPayment = responseSchemas.PosCheckout!.properties!
  .payment as SchemaObject;
delete posPayment.nullable;
posPayment.anyOf!.push({ type: 'string', nullable: true, enum: [null] });

export function responseOverride(
  path: string,
  verb: string,
  handler: string,
): Schema | undefined {
  const group = path.split('/')[3];
  if (handler === 'list' && (group === 'customers' || group === 'suppliers'))
    return page(
      ref(group === 'customers' ? 'CustomerListItem' : 'SupplierListItem'),
    );
  if (group === 'auth' && ['signup', 'login', 'me'].includes(handler))
    return object({
      user: ref('SafeUser'),
      ...(handler === 'signup'
        ? { emailDelivery: enumeration('not_configured') }
        : {}),
    });
  if (
    group === 'invoices' ||
    /^(quotations|sales-orders|delivery-challans|sales-returns|purchase-orders|purchase-bills|purchase-returns)$/.test(
      group ?? '',
    )
  ) {
    if (handler === 'list') return undefined;
    if (verb === 'delete')
      return object(group === 'invoices' ? { discarded: bool } : { ok: bool });
    const schema = ref(
      group === 'invoices' || handler === 'convertToInvoice'
        ? 'Invoice'
        : 'BusinessDocument',
    );
    return handler === 'preview' ? schema : profile(schema);
  }
  const finance: Record<string, string> = {
    accounts: 'MoneyAccount',
    payments: 'Payment',
    'expense-categories': 'ExpenseCategory',
    expenses: 'Expense',
    'account-transfers': 'AccountTransfer',
    receivables: 'Receivable',
    payables: 'Payable',
  };
  if (finance[group!] && !path.endsWith('/transactions')) {
    if (verb === 'delete') return object({ ok: bool });
    const schema = ref(finance[group!]!);
    return verb === 'get' && !path.includes('{id}')
      ? page(schema)
      : profile(schema);
  }
  if (group === 'pos') {
    if (handler === 'checkout') return ref('PosCheckout');
    if (handler === 'preview') return ref('Invoice');
    if (handler === 'sales') return page(ref('PosSale'));
    return handler === 'barcode'
      ? profile(ref('PosProduct'))
      : page(ref('PosProduct'));
  }
  if (group === 'gst-reports') {
    const summary: Record<string, string> = {
      summary: 'GstSummary',
      output: 'OutputTax',
      purchaseTax: 'PurchaseTax',
      returns: 'OperationalReturns',
    };
    if (summary[handler]) return ref(summary[handler]!);
    if (handler === 'sales') return page(ref('SalesGstRow'));
    if (handler === 'purchases') return page(ref('PurchaseGstRow'));
    if (handler === 'rates' || handler === 'hsn')
      return object({
        items: array(ref(handler === 'rates' ? 'GstRateRow' : 'HsnSacRow')),
      });
  }
  return undefined;
}
