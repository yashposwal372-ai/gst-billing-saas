import assert from 'node:assert/strict';

export function createPhase8Fixtures() {
  const account = { id: 'account-cash', accountCode: 'ACC-000001', name: 'Main Cash Account With A Long Name', type: 'CASH', currentBalance: '1250.00', openingBalance: '1000.00', isActive: true };
  const bank = { id: 'account-bank', accountCode: 'ACC-000002', name: 'HDFC Current Account', type: 'BANK', currentBalance: '5000.00', openingBalance: '5000.00', isActive: true };
  const customerDraft = { id: 'payment-customer-draft', paymentNumber: null, type: 'CUSTOMER_RECEIPT', status: 'DRAFT', paymentDate: '2026-09-09', amount: '100.00', method: 'CASH', allocations: [{ id: 'alloc-customer-draft', invoiceId: 'invoice-open', documentId: null, amount: '100.00' }] };
  const supplierDraft = { id: 'payment-supplier-draft', paymentNumber: null, type: 'SUPPLIER_PAYMENT', status: 'DRAFT', paymentDate: '2026-09-09', amount: '150.00', method: 'BANK_TRANSFER', allocations: [{ id: 'alloc-supplier-draft', invoiceId: null, documentId: 'bill-open', amount: '150.00' }] };
  const receipt = { id: 'payment-receipt', paymentNumber: 'RCPT/2026-27/000001', type: 'CUSTOMER_RECEIPT', status: 'POSTED', paymentDate: '2026-09-09', amount: '150.00', method: 'CASH', allocations: [{ id: 'alloc-1', invoiceId: 'invoice-open', documentId: null, amount: '100.00' }, { id: 'alloc-2', invoiceId: 'invoice-second', documentId: null, amount: '50.00' }] };
  const expense = { id: 'expense-1', expenseNumber: null, description: 'Office supplies', status: 'DRAFT', expenseDate: '2026-09-09', amount: '25.00', method: 'CASH', categoryId: 'cat-1', accountId: 'account-cash', referenceNumber: 'BILL-1', notes: 'Monthly office supplies' };
  const transfer = { id: 'transfer-1', transferNumber: 'TRF/2026-27/000001', transferDate: '2026-09-09', amount: '250.00', status: 'POSTED', referenceNumber: 'TRF-REF', notes: 'Cash to bank', fromAccount: account, toAccount: bank };
  const receivables = [
    { invoice: { id: 'invoice-open', invoiceNumber: 'INV/2026-27/000001' }, customer: { id: 'customer-1', name: 'Acme Retail Customer With A Very Long Name' }, invoiceDate: '2026-09-01', dueDate: '2026-09-05', grandTotal: '200.00', paidAmount: '100.00', outstanding: '100.00', paymentStatus: 'PARTIAL', daysOverdue: 4 },
    { invoice: { id: 'invoice-second', invoiceNumber: 'INV/2026-27/000002' }, customer: { id: 'customer-1', name: 'Acme Retail Customer With A Very Long Name' }, invoiceDate: '2026-09-02', dueDate: null, grandTotal: '50.00', paidAmount: '0.00', outstanding: '50.00', paymentStatus: 'UNPAID', daysOverdue: 0 },
    { invoice: { id: 'invoice-paid', invoiceNumber: 'INV/2026-27/000003' }, customer: { id: 'customer-2', name: 'Paid Customer' }, invoiceDate: '2026-09-03', dueDate: null, grandTotal: '75.00', paidAmount: '75.00', outstanding: '0.00', paymentStatus: 'PAID', daysOverdue: 0 },
  ];
  const payables = [
    { purchaseBill: { id: 'bill-open', documentNumber: 'PB/2026-27/000001' }, supplier: { id: 'supplier-1', name: 'Northwind Supplier' }, billDate: '2026-09-01', dueDate: null, grandTotal: '300.00', paidAmount: '150.00', outstanding: '150.00', paymentStatus: 'PARTIAL', daysOverdue: 0 },
    { purchaseBill: { id: 'bill-paid', documentNumber: 'PB/2026-27/000002' }, supplier: { id: 'supplier-1', name: 'Northwind Supplier' }, billDate: '2026-09-02', dueDate: null, grandTotal: '20.00', paidAmount: '20.00', outstanding: '0.00', paymentStatus: 'PAID', daysOverdue: 0 },
  ];
  const pageResult = (items, page, pageSize) => ({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) });
  const paymentWithNumber = (payment) => ({ ...payment, paymentNumber: payment.type === 'CUSTOMER_RECEIPT' ? 'RCPT/2026-27/000002' : 'PAY/2026-27/000001' });
  return { account, customerDraft, supplierDraft, expense, transfer, async respond(url, request) {
    const path = url.pathname; const page = Number(url.searchParams.get('page') ?? '1'); const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const settlementRows = (rows) => { const status = url.searchParams.get('status'); const out = status ? rows.filter((row) => row.paymentStatus === status || (status === 'OVERDUE' && row.daysOverdue > 0)) : rows; return pageResult(out, page, pageSize); };
    if (path.endsWith('/accounts/account-cash/transactions') || path.endsWith('/accounts/account-bank/transactions')) return { code: 200, body: pageResult([{ date: '2026-09-09', type: 'OPENING_BALANCE', description: 'Opening account balance', credit: '1000.00', debit: '0.00', balanceAfter: '1000.00' }, { date: '2026-09-09', type: 'CUSTOMER_RECEIPT', description: 'Customer receipt posted', credit: '150.00', debit: '0.00', balanceAfter: '1150.00' }], page, pageSize) };
    if (path.endsWith('/accounts/account-cash')) {
      if (request.method === 'DELETE') { account.isActive = false; return { code: 200, body: { profile: account } }; }
      if (request.method === 'PATCH') { account.isActive = true; return { code: 200, body: { profile: account } }; }
      return { code: 200, body: { profile: account } };
    }
    if (path.endsWith('/accounts')) return request.method === 'POST' ? { code: 201, body: { profile: account } } : { code: 200, body: pageResult([account, bank], page, pageSize) };
    if (path.endsWith('/receivables')) return { code: 200, body: settlementRows(receivables) };
    if (path.endsWith('/payables')) return { code: 200, body: settlementRows(payables) };
    if (path.endsWith('/payments/payment-customer-draft/post')) { Object.assign(customerDraft, paymentWithNumber(customerDraft), { status: 'POSTED' }); return { code: 201, body: { profile: customerDraft } }; }
    if (path.endsWith('/payments/payment-customer-draft/reverse')) { Object.assign(customerDraft, { status: 'REVERSED', reversalReason: 'Customer correction' }); return { code: 201, body: { profile: customerDraft } }; }
    if (path.endsWith('/payments/payment-supplier-draft/post')) { Object.assign(supplierDraft, paymentWithNumber(supplierDraft), { status: 'POSTED' }); return { code: 201, body: { profile: supplierDraft } }; }
    if (path.endsWith('/payments/payment-supplier-draft/reverse')) { Object.assign(supplierDraft, { status: 'REVERSED', reversalReason: 'Supplier correction' }); return { code: 201, body: { profile: supplierDraft } }; }
    if (path.endsWith('/payments/payment-receipt')) return { code: 200, body: { profile: receipt } };
    if (path.endsWith('/payments/payment-receipt/reverse')) return { code: 201, body: { profile: { ...receipt, status: 'REVERSED', reversalReason: 'Correction' } } };
    if (path.endsWith('/payments')) return request.method === 'POST' ? { code: 201, body: { profile: url.searchParams.get('type') === 'supplier-payment' ? supplierDraft : customerDraft } } : { code: 200, body: pageResult([customerDraft, supplierDraft, receipt], page, pageSize) };
    if (path.endsWith('/expense-categories')) return request.method === 'POST' ? { code: 201, body: { profile: { id: 'cat-1', name: 'Office', description: 'Office costs', isActive: true } } } : { code: 200, body: pageResult([{ id: 'cat-1', name: 'Office', description: 'Office costs', isActive: true }], page, pageSize) };
    if (path.endsWith('/expenses/expense-1/post')) { Object.assign(expense, { status: 'POSTED', expenseNumber: 'EXP/2026-27/000001' }); return { code: 201, body: { profile: expense } }; }
    if (path.endsWith('/expenses/expense-1/cancel')) { Object.assign(expense, { status: 'CANCELLED', cancellationReason: 'Duplicate bill' }); return { code: 201, body: { profile: expense } }; }
    if (path.endsWith('/expenses/expense-1')) {
      if (request.method === 'PATCH') { expense.description = 'Office supplies updated'; return { code: 200, body: { profile: expense } }; }
      return { code: 200, body: { profile: expense } };
    }
    if (path.endsWith('/expenses')) return request.method === 'POST' ? { code: 201, body: { profile: expense } } : { code: 200, body: pageResult([expense], page, pageSize) };
    if (path.endsWith('/account-transfers/transfer-1/reverse')) { Object.assign(transfer, { status: 'REVERSED', reversalReason: 'Wrong account' }); return { code: 201, body: { profile: transfer } }; }
    if (path.endsWith('/account-transfers/transfer-1')) return { code: 200, body: { profile: transfer } };
    if (path.endsWith('/account-transfers')) return request.method === 'POST' ? { code: 201, body: { profile: transfer } } : { code: 200, body: pageResult([transfer], page, pageSize) };
    return null;
  } };
}

async function clickText(evaluate, text) { await evaluate(`Array.from(document.querySelectorAll('button,a')).find(el=>el.textContent && el.textContent.includes(${JSON.stringify(text)})).click()`); }
async function fill(evaluate, selector, value) { await evaluate(`{ const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing field '+${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value')?.set; setter ? setter.call(el, ${JSON.stringify(value)}) : (el.value=${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }`); }
async function fillAt(evaluate, selector, index, value) { await evaluate(`{ const el=document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if(!el) throw new Error('Missing field '+${JSON.stringify(selector)}+' index '+${index}); const setter=Object.getOwnPropertyDescriptor(el.constructor.prototype,'value')?.set; setter ? setter.call(el, ${JSON.stringify(value)}) : (el.value=${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }`); }
async function typeInto(send, evaluate, selector, value) { await evaluate(`{ const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing field '+${JSON.stringify(selector)}); el.focus(); el.select?.(); }`); await send('Input.insertText', { text: value }); }
async function expectDialog(evaluate, title) { assert.equal(await evaluate(`document.querySelector('dialog[open]')?.innerText.includes(${JSON.stringify(title)}) === true`), true); assert.equal(await evaluate(`document.querySelector('dialog[open]')?.contains(document.activeElement) === true`), true); }
async function confirmDialog({ evaluate, key, title, reason }) { await expectDialog(evaluate, title); await key('Tab'); assert.equal(await evaluate(`document.querySelector('dialog[open]')?.contains(document.activeElement) === true`), true); await key('Escape'); await untilFor(evaluate, 'document.querySelector("dialog[open]") === null', title + ' closes with Escape'); await clickText(evaluate, title); await expectDialog(evaluate, title); if (reason) await fill(evaluate, 'dialog[open] textarea', reason); await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(button=>button.textContent.includes(${JSON.stringify(title)})).click()`); await untilFor(evaluate, 'document.querySelector("dialog[open]") === null', title + ' confirmed'); }
async function untilFor(evaluate, expression, label) { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await new Promise((done) => setTimeout(done, 100)); } throw new Error('Timed out: ' + label); }

export async function runPhase8Smoke({ send, evaluate, navigate, key, until }) {
  for (const width of [1440,1024,768,375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const paths = width === 1440 ? ['/accounts','/accounts/new','/accounts/account-cash','/accounts/account-cash/transactions','/payments/new?type=customer-receipt&invoiceId=invoice-open','/payments','/payments/payment-customer-draft','/account-transfers','/account-transfers/new','/account-transfers/transfer-1'] : width === 375 ? ['/payments/new?type=customer-receipt&invoiceId=invoice-open','/expenses','/expenses/new','/expenses/expense-1','/expenses/expense-1/edit'] : ['/accounts','/payments','/receivables?status=PARTIAL&page=1&pageSize=1','/payables?status=PAID','/expenses','/expense-categories','/account-transfers'];
    for (const path of paths) {
      await navigate(path);
      await until(() => evaluate('document.body.innerText.toLowerCase().includes("payments, expenses and banking") || document.body.innerText.toLowerCase().includes("cash/bank ledger") || document.body.innerText.toLowerCase().includes("payment detail") || document.body.innerText.toLowerCase().includes("expense") || document.body.innerText.toLowerCase().includes("internal account transfer") || document.body.innerText.toLowerCase().includes("recorded account")'), 'phase8 page ' + path);
      const sizes = await evaluate('({ width: innerWidth, doc: document.documentElement.scrollWidth })');
      assert.ok(sizes.doc <= sizes.width, 'Phase 8 overflow at ' + width + ' ' + path);
    }
    console.log('PASS Phase 8 finance routes:', width);
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/payments/new?type=customer-receipt&invoiceId=invoice-open'); await until(() => evaluate('document.body.innerText.includes("Record payment")'), 'customer receipt form');
  assert.equal(await evaluate('document.body.innerText.includes("Main Cash Account") && document.body.innerText.includes("INV/2026-27/000001")'), true);
  await fillAt(evaluate, 'select', 1, 'account-cash'); await until(() => evaluate('document.querySelectorAll("select")[1]?.value === "account-cash"'), 'customer account selected'); await fillAt(evaluate, 'select', 2, 'customer-1'); await until(() => evaluate('document.querySelectorAll("select")[2]?.value === "customer-1"'), 'customer selected'); await typeInto(send, evaluate, 'input[aria-label="Allocation amount"]', '100.00'); await until(() => evaluate('document.body.innerText.includes("Payment Amount: ₹100.00") && !Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("Save draft payment"))?.disabled'), 'customer allocation ready'); await clickText(evaluate, 'Save draft payment'); await until(() => evaluate('document.body.innerText.includes("Draft payment saved")'), 'customer receipt draft saved');
  await navigate('/payments'); await until(() => evaluate('document.body.innerText.includes("payment-customer-draft") || document.body.innerText.includes("Draft")'), 'customer draft in list');
  await clickText(evaluate, 'Post Payment'); await confirmDialog({ evaluate, key, title: 'Post Payment' }); await until(() => evaluate('document.body.innerText.includes("Posted")'), 'customer receipt posted');
  await navigate('/payments'); await until(() => evaluate('document.body.innerText.includes("RCPT/2026-27/000002")'), 'posted customer receipt visible');
  await clickText(evaluate, 'Reverse Payment'); await confirmDialog({ evaluate, key, title: 'Reverse Payment', reason: 'Customer correction' }); await until(() => evaluate('document.body.innerText.includes("Reversed")'), 'customer receipt reversed');

  await navigate('/payments/new?type=supplier-payment&documentId=bill-open'); await until(() => evaluate('document.body.innerText.includes("Record payment")'), 'supplier payment form');
  assert.equal(await evaluate('document.body.innerText.includes("Northwind Supplier") && document.body.innerText.includes("PB/2026-27/000001")'), true);
  await fillAt(evaluate, 'select', 1, 'account-bank'); await until(() => evaluate('document.querySelectorAll("select")[1]?.value === "account-bank"'), 'supplier account selected'); await fillAt(evaluate, 'select', 2, 'supplier-1'); await until(() => evaluate('document.querySelectorAll("select")[2]?.value === "supplier-1"'), 'supplier selected'); await typeInto(send, evaluate, 'input[aria-label="Allocation amount"]', '150.00'); await until(() => evaluate('document.body.innerText.includes("Payment Amount: ₹150.00") && !Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("Save draft payment"))?.disabled'), 'supplier allocation ready'); await clickText(evaluate, 'Save draft payment'); await until(() => evaluate('document.body.innerText.includes("Draft payment saved")'), 'supplier payment draft saved');
  await navigate('/payments'); await until(() => evaluate('document.body.innerText.includes("SUPPLIER_PAYMENT")'), 'supplier draft in list');
  await clickText(evaluate, 'Post Payment'); await confirmDialog({ evaluate, key, title: 'Post Payment' }); await navigate('/payments'); await until(() => evaluate('document.body.innerText.includes("PAY/2026-27/000001")'), 'posted supplier payment visible');
  await clickText(evaluate, 'Reverse Payment'); await confirmDialog({ evaluate, key, title: 'Reverse Payment', reason: 'Supplier correction' }); await until(() => evaluate('document.body.innerText.includes("Reversed")'), 'supplier payment reversed');

  await navigate('/expenses/new'); await until(() => evaluate('document.body.innerText.includes("Expense draft")'), 'expense form');
  await typeInto(send, evaluate, 'input[name="description"]', 'Office supplies'); await fill(evaluate, 'select[name="categoryId"]', 'cat-1'); await fill(evaluate, 'select[name="accountId"]', 'account-cash'); await typeInto(send, evaluate, 'input[name="amount"]', '25.00'); await clickText(evaluate, 'Save draft expense'); await until(() => evaluate('document.body.innerText.includes("Draft expense saved")'), 'expense created');
  await navigate('/expenses/expense-1/edit'); await until(() => evaluate('document.body.innerText.includes("Edit draft expense")'), 'expense edit'); await typeInto(send, evaluate, 'input[name="description"]', 'Office supplies updated'); await clickText(evaluate, 'Save draft'); await until(() => evaluate('document.body.innerText.includes("Expense draft updated")'), 'expense edited');
  await navigate('/expenses/expense-1'); await until(() => evaluate('document.body.innerText.includes("Office supplies updated")'), 'expense detail'); await clickText(evaluate, 'Post Expense'); await confirmDialog({ evaluate, key, title: 'Post Expense' }); await until(() => evaluate('document.body.innerText.includes("EXP/2026-27/000001") && document.body.innerText.includes("POSTED")'), 'expense posted');
  await clickText(evaluate, 'Cancel Expense'); await confirmDialog({ evaluate, key, title: 'Cancel Expense', reason: 'Duplicate bill' }); await until(() => evaluate('document.body.innerText.includes("CANCELLED")'), 'expense cancelled');

  await navigate('/account-transfers/new'); await until(() => evaluate('document.body.innerText.includes("Internal account transfer")'), 'transfer form');
  await fill(evaluate, 'select[name="fromAccountId"]', 'account-cash'); await fill(evaluate, 'select[name="toAccountId"]', 'account-bank'); await typeInto(send, evaluate, 'input[name="amount"]', '250.00'); await clickText(evaluate, 'Post transfer'); await until(() => evaluate('document.body.innerText.includes("Internal book transfer posted")'), 'transfer posted');
  await navigate('/account-transfers/transfer-1'); await until(() => evaluate('document.body.innerText.includes("TRF/2026-27/000001")'), 'transfer detail'); await clickText(evaluate, 'Reverse Transfer'); await confirmDialog({ evaluate, key, title: 'Reverse Transfer', reason: 'Wrong account' }); await until(() => evaluate('document.body.innerText.includes("REVERSED")'), 'transfer reversed');

  await navigate('/accounts/account-cash'); await until(() => evaluate('document.body.innerText.includes("Edit account metadata")'), 'account detail');
  await clickText(evaluate, 'Deactivate Account'); await confirmDialog({ evaluate, key, title: 'Deactivate Account' }); await until(() => evaluate('document.body.innerText.includes("Inactive") && document.body.innerText.includes("Reactivate Account")'), 'account deactivated');
  await clickText(evaluate, 'Reactivate Account'); await confirmDialog({ evaluate, key, title: 'Reactivate Account' }); await until(() => evaluate('document.body.innerText.includes("Active") && document.body.innerText.includes("Deactivate Account")'), 'account reactivated');

  await navigate('/receivables?status=OVERDUE'); await until(() => evaluate('document.body.innerText.includes("days overdue")'), 'overdue receivable');
  await key('Tab'); await key('Tab'); assert.equal(await evaluate('document.activeElement !== document.body'), true);
  console.log('PASS Phase 8 finance workflows using test-only API fixtures');
}

