# Current public route inventory

Generated from controller decorators and DTO source metadata. Runtime documentation setup separately verifies the routes and guards registered by Nest. Documentation routes are not part of `/api/v1`. Lifecycle routes can reject unsupported transitions.

| Method | Path | Operation ID | Access | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1` | `root.get` | Public | app.controller.ts |
| GET | `/api/v1/account-transfers` | `accountTransfers.list` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/account-transfers` | `accountTransfers.create` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/account-transfers/{id}` | `accountTransfers.get` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/account-transfers/{id}/reverse` | `accountTransfers.reverse` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/accounts` | `accounts.list` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/accounts` | `accounts.create` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| DELETE | `/api/v1/accounts/{id}` | `accounts.deactivate` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/accounts/{id}` | `accounts.get` | Access cookie | finance/finance.controller.ts |
| PATCH | `/api/v1/accounts/{id}` | `accounts.update` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/accounts/{id}/transactions` | `accounts.transactions` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/auth/forgot-password` | `auth.forgotPassword` | Public; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/login` | `auth.login` | Public; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/logout` | `auth.logout` | Public; Origin + CSRF | auth/auth.controller.ts |
| GET | `/api/v1/auth/me` | `auth.me` | Access cookie | auth/auth.controller.ts |
| POST | `/api/v1/auth/refresh` | `auth.refresh` | Refresh cookie; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/request-verification` | `auth.requestVerification` | Access cookie; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/reset-password` | `auth.resetPassword` | Public; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/signup` | `auth.signup` | Public; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/auth/verify-email` | `auth.verifyEmail` | Public; Origin + CSRF | auth/auth.controller.ts |
| POST | `/api/v1/businesses` | `businesses.create` | Access cookie; Origin + CSRF | businesses/businesses.controller.ts |
| GET | `/api/v1/businesses/current` | `businesses.current` | Access cookie | businesses/businesses.controller.ts |
| PATCH | `/api/v1/businesses/current` | `businesses.current.patch` | Access cookie; Origin + CSRF | businesses/businesses.controller.ts |
| GET | `/api/v1/categories` | `categories.list` | Access cookie | catalogue/catalogue.controller.ts |
| POST | `/api/v1/categories` | `categories.create` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| DELETE | `/api/v1/categories/{id}` | `categories.deactivate` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| GET | `/api/v1/categories/{id}` | `categories.get` | Access cookie | catalogue/catalogue.controller.ts |
| PATCH | `/api/v1/categories/{id}` | `categories.update` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| GET | `/api/v1/customers` | `customers.list` | Access cookie | customers/customers.controller.ts |
| POST | `/api/v1/customers` | `customers.create` | Access cookie; Origin + CSRF | customers/customers.controller.ts |
| DELETE | `/api/v1/customers/{id}` | `customers.deactivate` | Access cookie; Origin + CSRF | customers/customers.controller.ts |
| GET | `/api/v1/customers/{id}` | `customers.get` | Access cookie | customers/customers.controller.ts |
| PATCH | `/api/v1/customers/{id}` | `customers.update` | Access cookie; Origin + CSRF | customers/customers.controller.ts |
| GET | `/api/v1/dashboard/summary` | `dashboard.summary` | Access cookie | dashboard/dashboard.controller.ts |
| GET | `/api/v1/delivery-challans` | `deliveryChallans.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans` | `deliveryChallans.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/delivery-challans/{id}` | `deliveryChallans.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/delivery-challans/{id}` | `deliveryChallans.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/delivery-challans/{id}` | `deliveryChallans.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/accept` | `deliveryChallans.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/cancel` | `deliveryChallans.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/confirm` | `deliveryChallans.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/convert-to-invoice` | `deliveryChallans.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/convert/{target}` | `deliveryChallans.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/finalize` | `deliveryChallans.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/{id}/issue` | `deliveryChallans.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/delivery-challans/preview` | `deliveryChallans.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/expense-categories` | `expenseCategories.list` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/expense-categories` | `expenseCategories.create` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| DELETE | `/api/v1/expense-categories/{id}` | `expenseCategories.deactivate` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| PATCH | `/api/v1/expense-categories/{id}` | `expenseCategories.update` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/expenses` | `expenses.list` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/expenses` | `expenses.create` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| DELETE | `/api/v1/expenses/{id}` | `expenses.delete` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/expenses/{id}` | `expenses.get` | Access cookie | finance/finance.controller.ts |
| PATCH | `/api/v1/expenses/{id}` | `expenses.update` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| POST | `/api/v1/expenses/{id}/cancel` | `expenses.cancel` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| POST | `/api/v1/expenses/{id}/post` | `expenses.post` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/gst-reports/gst-rate-summary` | `gstReports.gstRateSummary` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/hsn-sac` | `gstReports.hsnSac` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/hsn-sac/export` | `gstReports.hsnSac.export` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/output-tax` | `gstReports.outputTax` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/place-of-supply` | `gstReports.placeOfSupply` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/purchase-register` | `gstReports.purchaseRegister` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/purchase-register/export` | `gstReports.purchaseRegister.export` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/purchase-tax` | `gstReports.purchaseTax` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/returns-summary` | `gstReports.returnsSummary` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/sales-register` | `gstReports.salesRegister` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/sales-register/export` | `gstReports.salesRegister.export` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/gst-reports/summary` | `gstReports.summary` | Access cookie | gst-reports/gst-reports.controller.ts |
| GET | `/api/v1/health` | `health.check` | Public | health/health.controller.ts |
| GET | `/api/v1/inventory/summary` | `inventory.summary` | Access cookie | catalogue/catalogue.controller.ts |
| GET | `/api/v1/invoices` | `invoices.list` | Access cookie | invoices/invoices.controller.ts |
| POST | `/api/v1/invoices` | `invoices.create` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| DELETE | `/api/v1/invoices/{id}` | `invoices.discard` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| GET | `/api/v1/invoices/{id}` | `invoices.get` | Access cookie | invoices/invoices.controller.ts |
| PATCH | `/api/v1/invoices/{id}` | `invoices.update` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| POST | `/api/v1/invoices/{id}/cancel` | `invoices.cancel` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| POST | `/api/v1/invoices/{id}/finalize` | `invoices.finalize` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| POST | `/api/v1/invoices/preview` | `invoices.preview` | Access cookie; Origin + CSRF | invoices/invoices.controller.ts |
| GET | `/api/v1/payables` | `payables.list` | Access cookie | finance/finance.controller.ts |
| GET | `/api/v1/payments` | `payments.list` | Access cookie | finance/finance.controller.ts |
| POST | `/api/v1/payments` | `payments.create` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| DELETE | `/api/v1/payments/{id}` | `payments.delete` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| GET | `/api/v1/payments/{id}` | `payments.get` | Access cookie | finance/finance.controller.ts |
| PATCH | `/api/v1/payments/{id}` | `payments.update` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| POST | `/api/v1/payments/{id}/post` | `payments.post` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| POST | `/api/v1/payments/{id}/reverse` | `payments.reverse` | Access cookie; Origin + CSRF | finance/finance.controller.ts |
| POST | `/api/v1/pos/checkout` | `pos.checkout` | Access cookie; Origin + CSRF | pos/pos.controller.ts |
| POST | `/api/v1/pos/preview` | `pos.preview` | Access cookie; Origin + CSRF | pos/pos.controller.ts |
| GET | `/api/v1/pos/products` | `pos.products` | Access cookie | pos/pos.controller.ts |
| GET | `/api/v1/pos/products/by-barcode/{barcode}` | `pos.products.byBarcode` | Access cookie | pos/pos.controller.ts |
| GET | `/api/v1/pos/sales` | `pos.sales` | Access cookie | pos/pos.controller.ts |
| GET | `/api/v1/products` | `products.list` | Access cookie | catalogue/catalogue.controller.ts |
| POST | `/api/v1/products` | `products.create` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| DELETE | `/api/v1/products/{id}` | `products.deactivate` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| GET | `/api/v1/products/{id}` | `products.get` | Access cookie | catalogue/catalogue.controller.ts |
| PATCH | `/api/v1/products/{id}` | `products.update` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| POST | `/api/v1/products/{id}/stock-adjustments` | `products.stockAdjustments` | Access cookie; Origin + CSRF | catalogue/catalogue.controller.ts |
| GET | `/api/v1/products/{id}/stock-movements` | `products.stockMovements` | Access cookie | catalogue/catalogue.controller.ts |
| GET | `/api/v1/products/by-barcode/{barcode}` | `products.byBarcode` | Access cookie | catalogue/catalogue.controller.ts |
| GET | `/api/v1/purchase-bills` | `purchaseBills.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills` | `purchaseBills.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/purchase-bills/{id}` | `purchaseBills.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/purchase-bills/{id}` | `purchaseBills.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/purchase-bills/{id}` | `purchaseBills.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/accept` | `purchaseBills.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/cancel` | `purchaseBills.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/confirm` | `purchaseBills.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/convert-to-invoice` | `purchaseBills.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/convert/{target}` | `purchaseBills.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/finalize` | `purchaseBills.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/{id}/issue` | `purchaseBills.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-bills/preview` | `purchaseBills.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/purchase-orders` | `purchaseOrders.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders` | `purchaseOrders.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/purchase-orders/{id}` | `purchaseOrders.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/purchase-orders/{id}` | `purchaseOrders.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/purchase-orders/{id}` | `purchaseOrders.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/accept` | `purchaseOrders.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/cancel` | `purchaseOrders.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/confirm` | `purchaseOrders.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/convert-to-invoice` | `purchaseOrders.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/convert/{target}` | `purchaseOrders.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/finalize` | `purchaseOrders.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/{id}/issue` | `purchaseOrders.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-orders/preview` | `purchaseOrders.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/purchase-returns` | `purchaseReturns.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns` | `purchaseReturns.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/purchase-returns/{id}` | `purchaseReturns.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/purchase-returns/{id}` | `purchaseReturns.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/purchase-returns/{id}` | `purchaseReturns.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/accept` | `purchaseReturns.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/cancel` | `purchaseReturns.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/confirm` | `purchaseReturns.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/convert-to-invoice` | `purchaseReturns.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/convert/{target}` | `purchaseReturns.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/finalize` | `purchaseReturns.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/{id}/issue` | `purchaseReturns.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/purchase-returns/preview` | `purchaseReturns.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/quotations` | `quotations.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations` | `quotations.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/quotations/{id}` | `quotations.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/quotations/{id}` | `quotations.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/quotations/{id}` | `quotations.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/accept` | `quotations.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/cancel` | `quotations.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/confirm` | `quotations.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/convert-to-invoice` | `quotations.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/convert/{target}` | `quotations.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/finalize` | `quotations.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/{id}/issue` | `quotations.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/quotations/preview` | `quotations.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/receivables` | `receivables.list` | Access cookie | finance/finance.controller.ts |
| GET | `/api/v1/sales-orders` | `salesOrders.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders` | `salesOrders.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/sales-orders/{id}` | `salesOrders.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/sales-orders/{id}` | `salesOrders.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/sales-orders/{id}` | `salesOrders.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/accept` | `salesOrders.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/cancel` | `salesOrders.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/confirm` | `salesOrders.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/convert-to-invoice` | `salesOrders.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/convert/{target}` | `salesOrders.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/finalize` | `salesOrders.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/{id}/issue` | `salesOrders.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-orders/preview` | `salesOrders.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/sales-returns` | `salesReturns.list` | Access cookie | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns` | `salesReturns.create` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| DELETE | `/api/v1/sales-returns/{id}` | `salesReturns.delete` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/sales-returns/{id}` | `salesReturns.get` | Access cookie | business-documents/business-documents.controller.ts |
| PATCH | `/api/v1/sales-returns/{id}` | `salesReturns.update` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/accept` | `salesReturns.accept` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/cancel` | `salesReturns.cancel` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/confirm` | `salesReturns.confirm` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/convert-to-invoice` | `salesReturns.convertToInvoice` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/convert/{target}` | `salesReturns.convert` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/finalize` | `salesReturns.finalize` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/{id}/issue` | `salesReturns.issue` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| POST | `/api/v1/sales-returns/preview` | `salesReturns.preview` | Access cookie; Origin + CSRF | business-documents/business-documents.controller.ts |
| GET | `/api/v1/suppliers` | `suppliers.list` | Access cookie | suppliers/suppliers.controller.ts |
| POST | `/api/v1/suppliers` | `suppliers.create` | Access cookie; Origin + CSRF | suppliers/suppliers.controller.ts |
| DELETE | `/api/v1/suppliers/{id}` | `suppliers.deactivate` | Access cookie; Origin + CSRF | suppliers/suppliers.controller.ts |
| GET | `/api/v1/suppliers/{id}` | `suppliers.get` | Access cookie | suppliers/suppliers.controller.ts |
| PATCH | `/api/v1/suppliers/{id}` | `suppliers.update` | Access cookie; Origin + CSRF | suppliers/suppliers.controller.ts |
