// Test-only intercepted API fixtures. No production code imports this module.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Buffer } from "node:buffer";
const categoryId = "22222222-2222-4222-8222-222222222222";
const productId = "11111111-1111-4111-8111-111111111111";
const date = "2026-09-08T06:00:00.000Z";
const scaled = (value) => {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
};
const decimal = (value) =>
  value / 1000n + "." + String(value % 1000n).padStart(3, "0");
export function createCatalogueFixtures() {
  const state = { error: false, slow: false, empty: false, conflict: false };
  let counter = 30;
  const categories = [
    {
      id: categoryId,
      name: "Staples and everyday business supplies",
      description:
        "A deliberately long category description for responsive checks.",
      isActive: true,
      createdAt: date,
      updatedAt: date,
    },
  ];
  const base = {
    id: productId,
    productCode: "PRD-000001",
    name: "Premium rice and everyday supplies with a deliberately long catalogue name",
    description: "Sample catalogue item used only by the browser smoke test.",
    type: "PRODUCT",
    unit: "KG",
    categoryId,
    sku: "RICE-" + "X".repeat(75),
    barcode: "8901" + "2".repeat(96),
    hsnSacCode: "1006",
    gstRate: "5.00",
    purchasePrice: "90.10",
    salePrice: "110.30",
    mrp: null,
    trackInventory: true,
    openingStock: "10.125",
    currentStock: "2.125",
    minimumStock: "5.000",
    isActive: true,
    createdAt: date,
    updatedAt: date,
  };
  let products = [
    base,
    ...Array.from({ length: 24 }, (_, i) => ({
      ...base,
      id: "10000000-0000-4000-8000-" + String(i + 2).padStart(12, "0"),
      name: "Supply " + String(i + 2).padStart(2, "0"),
      productCode: "PRD-" + String(i + 2).padStart(6, "0"),
      sku: null,
      barcode: null,
      currentStock: i === 0 ? "0.000" : "12.000",
    })),
    {
      ...base,
      id: "33333333-3333-4333-8333-333333333333",
      name: "Consulting service",
      type: "SERVICE",
      unit: "HOUR",
      hsnSacCode: "998311",
      trackInventory: false,
      openingStock: "0.000",
      currentStock: "0.000",
      minimumStock: null,
      sku: null,
      barcode: null,
    },
  ];
  const history = [
    {
      id: "opening",
      productId,
      quantity: "10.125",
      beforeStock: "0.000",
      afterStock: "10.125",
      type: "OPENING",
      reason: "Opening stock",
      createdById: "test-owner",
      createdAt: date,
    },
    {
      id: "prior",
      productId,
      quantity: "8.000",
      beforeStock: "10.125",
      afterStock: "2.125",
      type: "ADJUSTMENT_OUT",
      reason: "Physical count correction",
      createdById: "test-owner",
      createdAt: date,
    },
  ];
  const view = (p) => ({
    ...p,
    category: categories.find((c) => c.id === p.categoryId) ?? null,
    stockStatus:
      !p.trackInventory || !p.isActive
        ? "not_tracked"
        : scaled(p.currentStock) === 0n
          ? "out"
          : p.minimumStock && scaled(p.currentStock) <= scaled(p.minimumStock)
            ? "low"
            : "available",
  });
  const page = (items, q) => {
    const page = Number(q.get("page") || 1),
      pageSize = Number(q.get("pageSize") || 20);
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  };
  return {
    state,
    productId,
    async respond(url, request) {
      const path = url.pathname.replace("/api/v1", "");
      if (!/^\/(products|categories|inventory)(\/|$)/.test(path)) return null;
      if (request.method === "OPTIONS") return { code: 204, body: {} };
      if (state.slow) await new Promise((r) => setTimeout(r, 900));
      if (state.error)
        return {
          code: 503,
          body: { message: "Private database error must not render" },
        };
      const q = url.searchParams,
        method = request.method,
        body = request.postData ? JSON.parse(request.postData) : {};
      const fail = (message) => ({ code: 400, body: { message } });
      if (state.conflict && ["POST", "PATCH"].includes(method))
        return {
          code: 409,
          body: { message: "This SKU or category already exists" },
        };
      if (path === "/inventory/summary") {
        const active = products.filter(
          (p) => p.isActive && p.type === "PRODUCT",
        );
        return {
          code: 200,
          body: {
            totalActiveProducts: active.length,
            inventoryTrackedProducts: active.filter((p) => p.trackInventory)
              .length,
            lowStockProducts: active.filter(
              (p) => view(p).stockStatus === "low",
            ).length,
            outOfStockProducts: active.filter(
              (p) => view(p).stockStatus === "out",
            ).length,
          },
        };
      }
      if (path.startsWith("/categories")) {
        const id = path.split("/")[2];
        let c = categories.find((c) => c.id === id);
        if (method === "POST") {
          c = {
            id:
              "20000000-0000-4000-8000-" + String(++counter).padStart(12, "0"),
            name: body.name,
            description: body.description || null,
            isActive: true,
            createdAt: date,
            updatedAt: date,
          };
          categories.push(c);
        }
        if (method === "PATCH" && c) Object.assign(c, body);
        if (id || method === "POST")
          return { code: method === "POST" ? 201 : 200, body: { profile: c } };
        const status = q.get("status") || "active",
          search = (q.get("search") || "").toLowerCase();
        return {
          code: 200,
          body: page(
            state.empty
              ? []
              : categories.filter(
                  (c) =>
                    (status === "all" ||
                      c.isActive === (status === "active")) &&
                    c.name.toLowerCase().includes(search),
                ),
            q,
          ),
        };
      }
      const id = path.split("/")[2];
      let p = products.find((p) => p.id === id);
      if ((path === "/products" && method === "POST") || (p && method === "PATCH")) {
        for (const field of ["sku", "barcode"]) {
          if (body[field] && products.some((item) => item.id !== id && item[field] === body[field]))
            return { code: 409, body: { message: "This " + field.toUpperCase() + " already exists in this business" } };
        }
      }
      if (path.endsWith("/stock-movements"))
        return {
          code: 200,
          body: page(
            history
              .filter(
                (m) =>
                  m.productId === id &&
                  (!q.get("type") || m.type === q.get("type")),
              )
              .toReversed(),
            q,
          ),
        };
      if (path.endsWith("/stock-adjustments") && p) {
        const qty = scaled(body.quantity),
          before = scaled(p.currentStock),
          after = body.direction === "INCREASE" ? before + qty : before - qty;
        if (after < 0n)
          return fail("Insufficient stock; negative stock is not allowed");
        const movement = {
          id: "movement-" + ++counter,
          productId: id,
          type:
            body.direction === "INCREASE" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          quantity: decimal(qty),
          beforeStock: decimal(before),
          afterStock: decimal(after),
          reason: body.reason,
          createdById: "test-owner",
          createdAt: new Date().toISOString(),
        };
        p.currentStock = decimal(after);
        p.updatedAt = movement.createdAt;
        history.push(movement);
        return { code: 201, body: { profile: view(p), movement } };
      }
      if (method === "POST") {
        p = {
          ...base,
          ...body,
          id: "10000000-0000-4000-8000-" + String(++counter).padStart(12, "0"),
          productCode: "PRD-" + String(counter).padStart(6, "0"),
          description: body.description || null,
          categoryId: body.categoryId || null,
          sku: body.sku || null,
          barcode: body.barcode || null,
          hsnSacCode: body.hsnSacCode || null,
          mrp: body.mrp || null,
          minimumStock: body.minimumStock
            ? decimal(scaled(body.minimumStock))
            : null,
          openingStock: decimal(scaled(body.openingStock || "0")),
          currentStock: decimal(scaled(body.openingStock || "0")),
        };
        products.push(p);
        if (scaled(p.openingStock) > 0n)
          history.push({
            id: "open-" + counter,
            productId: p.id,
            type: "OPENING",
            quantity: p.openingStock,
            beforeStock: "0.000",
            afterStock: p.openingStock,
            reason: "Opening stock",
            createdById: "test-owner",
            createdAt: date,
          });
      }
      if (method === "PATCH" && p) {
        Object.assign(p, body, { updatedAt: new Date().toISOString() });
        // Match NestJS productData/productView: cleared optional values are null.
        for (const field of ["description", "categoryId", "sku", "barcode", "hsnSacCode", "mrp", "minimumStock"])
          if (p[field] === "") p[field] = null;
      }
      if (id || method === "POST")
        return p
          ? { code: method === "POST" ? 201 : 200, body: { profile: view(p) } }
          : { code: 404, body: { message: "Product not found" } };
      let rows = products.map(view);
      const status = q.get("status") || "active",
        search = (q.get("search") || "").toLowerCase();
      rows = rows.filter(
        (p) =>
          (status === "all" || p.isActive === (status === "active")) &&
          (!q.get("type") || p.type === q.get("type")) &&
          (!q.get("categoryId") || p.categoryId === q.get("categoryId")) &&
          (!q.get("gstRate") || p.gstRate === q.get("gstRate")) &&
          [p.name, p.productCode, p.sku, p.barcode, p.hsnSacCode].some((v) =>
            v?.toLowerCase().includes(search),
          ),
      );
      if (q.get("stockStatus") === "tracked")
        rows = rows.filter((p) => p.trackInventory);
      else if (["low", "out"].includes(q.get("stockStatus")))
        rows = rows.filter((p) => p.stockStatus === q.get("stockStatus"));
      return { code: 200, body: page(state.empty ? [] : rows, q) };
    },
  };
}
export async function runCatalogueSmoke({
  send,
  evaluate,
  navigate,
  key,
  until,
  artifacts,
  fixtures,
}) {
  const text = (phrase) =>
    until(
      () =>
        evaluate(
          "document.body.innerText.includes(" + JSON.stringify(phrase) + ")",
        ),
      phrase,
    );
  const click = (label) =>
    evaluate(
      '(()=>{const b=Array.from(document.querySelectorAll("main button,dialog button")).find(b=>b.textContent.trim()===' +
        JSON.stringify(label) +
        ");b.focus();b.click()})()",
    );
  const input = async (id, value) => {
    await evaluate(
      "document.getElementById(" +
        JSON.stringify(id) +
        ").focus();document.getElementById(" +
        JSON.stringify(id) +
        ").select()",
    );
    await send("Input.insertText", { text: value });
  };
  const select = async (id, value) =>
    evaluate(
      "document.getElementById(" +
        JSON.stringify(id) +
        ").value=" +
        JSON.stringify(value) +
        ";document.getElementById(" +
        JSON.stringify(id) +
        ').dispatchEvent(new Event("change",{bubbles:true}))',
    );
  async function screenshot(name, width) {
    assert.ok(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      "overflow " + name + width,
    );
    assert.ok(
      await evaluate(
        'document.querySelector("main").scrollWidth<=document.querySelector("main").clientWidth',
      ),
      "main overflow " + name + width,
    );
    const image = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      join(artifacts, name + "-" + width + ".png"),
      Buffer.from(image.data, "base64"),
    );
  }
  for (const width of [1440, 1024, 768, 375]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const [path, ready, name] of [
      ["/products", "Premium rice", "products"],
      ["/products/new", "Item details", "product-new"],
      [
        "/products/" + fixtures.productId,
        "Stock movement history",
        "product-detail",
      ],
      [
        "/products/" + fixtures.productId + "/edit",
        "Edit item",
        "product-edit",
      ],
      ["/inventory", "Inventory tracked", "inventory"],
      ["/categories", "Staples and everyday", "categories"],
    ]) {
      await navigate(path);
      await text(ready);
      await screenshot(name, width);
    }
    await click("Add category");
    await until(
      () => evaluate('Boolean(document.querySelector("dialog[open]"))'),
      "category dialog",
    );
    await screenshot("category-dialog", width);
    for (let i = 0; i < 8; i++) {
      await key("Tab");
      assert.equal(
        await evaluate(
          'document.querySelector("dialog[open]").contains(document.activeElement)',
        ),
        true,
      );
    }
    await key("Escape");
    await until(
      () => evaluate('!document.querySelector("dialog[open]")'),
      "dialog Escape",
    );
    assert.equal(await evaluate('document.activeElement.textContent.trim()'), "Add category", "category focus restoration");
    await navigate("/products/" + fixtures.productId);
    await text("Stock movement history");
    await click("Adjust stock");
    await text("Current stock:");
    await screenshot("stock-dialog", width);
    for (let i = 0; i < 8; i++) {
      await key("Tab");
      assert.ok(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'));
    }
    await key("Escape");
    await until(() => evaluate('!document.querySelector("dialog[open]")'), "stock dialog Escape");
    assert.equal(await evaluate('document.activeElement.textContent.trim()'), "Adjust stock", "stock focus restoration");
    console.log("PASS catalogue pages and dialogs:", width);
  }
  await navigate("/categories");
  await text("Staples and everyday");
  await click("Add category");
  await input("categoryName", "Smoke category");
  await click("Save category");
  await text("Category saved.");
  await text("Smoke category");
  await evaluate(
    'Array.from(document.querySelectorAll("tbody tr")).find(r=>r.textContent.includes("Smoke category")).querySelector("button").click()',
  );
  await input("categoryName", "Renamed category");
  await click("Save category");
  await text("Renamed category");
  await evaluate(
    'Array.from(document.querySelectorAll("tbody tr")).find(r=>r.textContent.includes("Renamed category")).querySelectorAll("button")[1].click()',
  );
  await click("Confirm");
  await until(
    () => evaluate('!document.querySelector("dialog[open]")'),
    "category deactivated",
  );
  await navigate("/categories?status=inactive");
  await text("Renamed category");
  await click("Reactivate");
  await click("Confirm");
  await until(
    () => evaluate('!document.querySelector("dialog[open]")'),
    "category reactivated",
  );
  await navigate("/products/new");
  await text("Item details");
  await click("Save item");
  await text("Enter an item name");
  await input("name", "Smoke product");
  await evaluate('document.getElementById("trackInventory").click()');
  await input("openingStock", "3.125");
  await input("minimumStock", "5.000");
  await input("salePrice", "12.34");
  await click("Save item");
  await text("Item saved.");
  await text("3.125");
  assert.ok(await evaluate('document.body.innerText.includes("OPENING")'));
  await evaluate(
    'Array.from(document.querySelectorAll("main a")).find(a=>a.textContent==="Edit item").click()',
  );
  await until(() => evaluate('Boolean(document.getElementById("unit"))'), "edit form ready");
  assert.equal(
    await evaluate('document.getElementById("unit").disabled'),
    true,
  );
  await input("name", "Edited smoke product");
  await click("Save item");
  await text("Edited smoke product");
  await text("Item information");
  await click("Adjust stock");
  await input("quantity", "0.001");
  await input("reason", "Count correction");
  await click("Confirm");
  await text("3.126");
  await click("Adjust stock");
  await evaluate(
    'document.querySelector("dialog select").value="DECREASE";document.querySelector("dialog select").dispatchEvent(new Event("change",{bubbles:true}))',
  );
  await input("quantity", "0.126");
  await input("reason", "Damaged stock");
  await click("Confirm");
  await text("3.000");
  await click("Adjust stock");
  await evaluate(
    'document.querySelector("dialog select").value="DECREASE";document.querySelector("dialog select").dispatchEvent(new Event("change",{bubbles:true}))',
  );
  await input("quantity", "99");
  await input("reason", "Excess removal");
  await click("Confirm");
  await text("Insufficient stock");
  await key("Escape");
  await click("Deactivate");
  await click("Confirm");
  await text("Reactivate");
  await click("Reactivate");
  await click("Confirm");
  await text("Deactivate");
  await navigate("/products/new");
  await text("Item details");
  await select("type", "SERVICE");
  await input("name", "Smoke consulting");
  assert.equal(
    await evaluate('document.getElementById("trackInventory").disabled'),
    true,
  );
  await input("hsnSacCode", "998311");
  await click("Save item");
  await text("Smoke consulting");
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent==="Adjust stock")',
    ),
    false,
  );
  await navigate("/products?stockStatus=low");
  await text("Premium rice");
  await navigate("/products?page=2");
  await text("Page 2");
  await navigate("/products?search=Smoke%20consulting");
  await text("Smoke consulting");
  fixtures.state.empty = true;
  await navigate("/products");
  await text("No matching items");
  fixtures.state.empty = false;
  fixtures.state.error = true;
  await navigate("/products");
  await text("Could not load");
  assert.equal(
    await evaluate(
      'document.body.innerText.includes("Private database error")',
    ),
    false,
  );
  fixtures.state.error = false;
  await click("Try again");
  await text("Premium rice");
  fixtures.state.slow = true;
  await navigate("/inventory");
  await text("Loading");
  await text("Inventory tracked");
  fixtures.state.slow = false;
  await navigate("/products/new");
  await text("Item details");
  await input("name", "Duplicate");
  await input("sku", "RICE-" + "X".repeat(75));
  await click("Save item");
  await text("SKU already exists");
  await input("sku", "");
  await input("barcode", "8901" + "2".repeat(96));
  await click("Save item");
  await text("BARCODE already exists");
  console.log(
    "PASS category CRUD, product/service create/edit, stock precision, negative rejection, history, status, filters, pagination, empty/error/retry/loading/conflict",
  );
}
