// Test-only intercepted API fixtures and checks for Phase 6 invoice browser smoke.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const invoiceId = "66666666-6666-4666-8666-666666666666";
const productId = "77777777-7777-4777-8777-777777777777";
const serviceId = "88888888-8888-4888-8888-888888888888";
const customerId = "99999999-9999-4999-8999-999999999999";
const now = "2026-09-08T09:00:00.000Z";

function product(overrides = {}) {
  return {
    id: productId,
    productCode: "PRD-000001",
    name: "Premium rice and taxable goods with a long responsive invoice name",
    description: null,
    type: "PRODUCT",
    unit: "KG",
    categoryId: null,
    category: null,
    sku: "RICE-001",
    barcode: null,
    hsnSacCode: "1006",
    gstRate: "5.00",
    purchasePrice: "90.00",
    salePrice: "100.00",
    mrp: null,
    trackInventory: true,
    openingStock: "10.000",
    currentStock: "10.000",
    minimumStock: "2.000",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    stockStatus: "available",
    ...overrides,
  };
}

const customer = {
  id: customerId,
  displayName: "Retail Buyer With A Very Long Invoice Layout Name",
  businessName: "Retail Buyer LLP",
  phone: "9876543210",
  email: "buyer@example.test",
  gstRegistered: true,
  gstin: "27ABCDE1234F1Z5",
  state: "Maharashtra",
  stateCode: "27",
  openingBalance: "0.00",
  openingBalanceType: "RECEIVABLE",
  isActive: true,
  createdAt: now,
  updatedAt: now,
  customerCode: "CUS-000001",
};

function invoice(status = "DRAFT", overrides = {}) {
  const finalized = status !== "DRAFT";
  const cancelled = status === "CANCELLED";
  return {
    id: invoiceId,
    status,
    invoiceNumber: finalized ? "INV/2026-27/000001" : null,
    customerId,
    financialYear: "2026-27",
    invoiceDate: "2026-09-08",
    dueDate: "2026-09-20",
    placeOfSupplyState: "Maharashtra",
    placeOfSupplyStateCode: "27",
    priceMode: "EXCLUSIVE",
    customerNameSnapshot: customer.displayName,
    customerCodeSnapshot: customer.customerCode,
    customerGstinSnapshot: customer.gstin,
    billingAddressLine1: "2 Buyer Road",
    billingCity: "Pune",
    billingState: "Maharashtra",
    billingPincode: "411001",
    sellerBusinessName: "Shah & Sons Trading Company",
    sellerLegalName: "Shah Legal Co",
    sellerGstin: "27AAACB1234C1Z5",
    sellerAddressLine1: "1 Market Street",
    sellerCity: "Pune",
    sellerState: "Maharashtra",
    sellerPincode: "411001",
    subtotal: "200.00",
    discountTotal: "0.00",
    taxableTotal: "200.00",
    cgstTotal: "5.00",
    sgstTotal: "5.00",
    igstTotal: "0.00",
    taxTotal: "10.00",
    roundOff: "0.00",
    grandTotal: "210.00",
    cancellationReason: cancelled ? "Customer cancelled before dispatch" : null,
    notes: "Please pay by bank transfer.",
    terms: "Goods once sold are subject to the draft terms.",
    lines: [
      {
        id: "line-1",
        productId,
        lineNumber: 1,
        productCodeSnapshot: "PRD-000001",
        productNameSnapshot: "Premium rice and taxable goods with a long responsive invoice name",
        productTypeSnapshot: "PRODUCT",
        hsnSacCodeSnapshot: "1006",
        unitSnapshot: "KG",
        quantity: "2.000",
        unitPrice: "100.00",
        priceMode: "EXCLUSIVE",
        discountType: "NONE",
        discountValue: "0.00",
        discountAmount: "0.00",
        grossAmount: "200.00",
        taxableAmount: "200.00",
        gstRate: "5.00",
        cgstRate: "2.50",
        cgstAmount: "5.00",
        sgstRate: "2.50",
        sgstAmount: "5.00",
        igstRate: "0.00",
        igstAmount: "0.00",
        taxAmount: "10.00",
        lineTotal: "210.00",
      },
    ],
    ...overrides,
  };
}

export function createInvoiceFixtures() {
  const state = { error: false, slowPreview: false, previewCalls: [], saved: invoice("DRAFT") };
  const products = [
    product(),
    product({
      id: serviceId,
      productCode: "PRD-000002",
      name: "Implementation consulting service",
      type: "SERVICE",
      unit: "HOUR",
      hsnSacCode: "998311",
      gstRate: "18.00",
      salePrice: "500.00",
      trackInventory: false,
      openingStock: "0.000",
      currentStock: "0.000",
      minimumStock: null,
      stockStatus: "not_tracked",
    }),
  ];
  const page = (items) => ({ items, total: items.length, page: 1, pageSize: 100, totalPages: 1 });
  state.respond = async (url, request) => {
    const path = url.pathname.replace("/api/v1", "");
    if (!/^\/(invoices|customers|products)(\/|$)/.test(path)) return null;
    if (request.method === "OPTIONS") return { code: 204, body: {} };
    if (path.startsWith("/customers")) return { code: 200, body: page([customer]) };
    if (path.startsWith("/products")) return { code: 200, body: page(products) };
    if (state.error) return { code: 503, body: { message: "Private invoice store error" } };
    const body = request.postData ? JSON.parse(request.postData) : {};
    if (path === "/invoices/preview") {
      const quantity = body.lines?.[0]?.quantity ?? "1";
      state.previewCalls.push(quantity);
      if (state.slowPreview && quantity === "1") await new Promise((resolve) => setTimeout(resolve, 700));
      return { code: 200, body: invoice("DRAFT", { grandTotal: quantity === "2" ? "210.00" : "105.00", subtotal: quantity === "2" ? "200.00" : "100.00", taxableTotal: quantity === "2" ? "200.00" : "100.00", cgstTotal: quantity === "2" ? "5.00" : "2.50", sgstTotal: quantity === "2" ? "5.00" : "2.50", taxTotal: quantity === "2" ? "10.00" : "5.00" }) };
    }
    if (path === "/invoices" && request.method === "POST") {
      state.saved = invoice("DRAFT");
      return { code: 201, body: { profile: state.saved } };
    }
    if (path === "/invoices") return { code: 200, body: page([state.saved]) };
    if (path.endsWith("/finalize")) {
      state.saved = invoice("FINALIZED");
      return { code: 200, body: { profile: state.saved } };
    }
    if (path.endsWith("/cancel")) {
      state.saved = invoice("CANCELLED");
      return { code: 200, body: { profile: state.saved } };
    }
    if (request.method === "DELETE") return { code: 200, body: { ok: true } };
    return { code: 200, body: { profile: state.saved } };
  };
  return state;
}

export async function runInvoiceSmoke({ send, evaluate, navigate, key, until, artifacts, fixtures }) {
  const text = (phrase) => until(() => evaluate("document.body.innerText.includes(" + JSON.stringify(phrase) + ")"), phrase);
  const click = (label) => evaluate('(()=>{const el=Array.from(document.querySelectorAll("main a,main button,dialog button")).find(el=>el.textContent.trim()===' + JSON.stringify(label) + ');el.focus();el.click()})()');
  const setInput = async (selector, value) => {
    await evaluate("document.querySelector(" + JSON.stringify(selector) + ").focus();document.querySelector(" + JSON.stringify(selector) + ").select()");
    await send("Input.insertText", { text: value });
  };
  const screenshot = async (name, width) => {
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true, name + " document overflow " + width);
    assert.equal(await evaluate('document.querySelector("main").scrollWidth<=document.querySelector("main").clientWidth'), true, name + " main overflow " + width);
    const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(join(artifacts, name + "-" + width + ".png"), Buffer.from(image.data, "base64"));
  };

  for (const width of [1440, 1024, 768, 375]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const [path, ready, name] of [
      ["/invoices", "Invoices", "invoices-list"],
      ["/invoices/new", "Create invoice", "invoice-new"],
      ["/invoices/" + invoiceId, "Line items", "invoice-detail"],
      ["/invoices/" + invoiceId + "/edit", "Edit draft", "invoice-edit"],
      ["/invoices/" + invoiceId + "/print", "TAX INVOICE", "invoice-print"],
    ]) {
      await navigate(path);
      await text(ready);
      await screenshot(name, width);
    }
    await navigate("/invoices/" + invoiceId);
    await text("Finalize invoice");
    await click("Finalize invoice");
    await text("A permanent invoice number");
    for (let i = 0; i < 8; i++) {
      await key("Tab");
      assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'), true);
    }
    await key("Escape");
    await until(() => evaluate('!document.querySelector("dialog[open]")'), "finalize dialog Escape");
    assert.equal(await evaluate("document.activeElement.textContent.trim()"), "Finalize invoice");
    console.log("PASS invoice pages, print layout and finalize dialog:", width);
  }

  await navigate("/invoices/new");
  await text("Create invoice");
  await until(() => evaluate('document.querySelectorAll("select")[2].options.length > 1'), "products loaded");
  fixtures.slowPreview = true;
  await evaluate('document.querySelectorAll("select")[2].value=' + JSON.stringify(productId) + ';document.querySelectorAll("select")[2].dispatchEvent(new Event("change",{bubbles:true}))');
  await setInput('input[inputmode="decimal"]', "1");
  await setInput('input[inputmode="decimal"]', "2");
  await text("210.00");
  assert.equal(await evaluate('document.body.innerText.includes("105.00")'), false, "stale slower preview must not overwrite latest totals");
  fixtures.slowPreview = false;
  await click("Add line");
  await evaluate('document.querySelectorAll("select")[4].value=' + JSON.stringify(serviceId) + ';document.querySelectorAll("select")[4].dispatchEvent(new Event("change",{bubbles:true}))');
  await click("Save draft");
  await text("Draft");
  await click("Finalize invoice");
  await text("stock will be deducted");
  await click("Finalize");
  await text("INV/2026-27/000001");
  await text("Cancel invoice");
  await click("Cancel invoice");
  await text("Cancellation reason");
  await setInput("dialog textarea", "Customer cancelled before dispatch");
  await evaluate('Array.from(document.querySelectorAll("dialog[open] button")).find(button=>button.textContent.trim()==="Cancel invoice").click()');
  await text("CANCELLED");
  await text("Customer cancelled before dispatch");
  await navigate("/invoices/" + invoiceId + "/print");
  await text("TAX INVOICE");
  await text("CANCELLED");
  assert.equal(await evaluate('Boolean(document.querySelector(".invoiceCancelledWatermark"))'), true);
  console.log("PASS invoice create/preview race/draft/finalize/cancel/print workflow using test-only API fixtures");
}
