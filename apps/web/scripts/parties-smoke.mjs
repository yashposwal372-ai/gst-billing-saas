// Test-only fixtures and scenarios, invoked by dashboard-smoke.mjs --parties.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
export function createPartyFixtures() {
  const id = "11111111-1111-4111-8111-111111111111";
  const base = {
    id,
    displayName:
      "Market Traders — A deliberately long customer or supplier name for layout checks",
    businessName: "Market Traders",
    contactPerson: "Test Contact",
    phone: "9876543210",
    whatsappNumber: null,
    email: "contact@example.test",
    gstRegistered: false,
    gstin: null,
    pan: null,
    addressLine1: "12 Market Road",
    addressLine2: null,
    city: "Pune",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "411001",
    openingBalance: "123.45",
    openingBalanceType: "RECEIVABLE",
    paymentTermsDays: 30,
    notes: "Test-only record. No actual persistence.",
    isActive: true,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  };
  const records = {
    customers: {
      ...base,
      customerCode: "CUS-000001",
      customerType: "BUSINESS",
      shippingSameAsBilling: true,
      shippingAddressLine1: null,
      shippingAddressLine2: null,
      shippingCity: null,
      shippingState: null,
      shippingStateCode: null,
      shippingPincode: null,
      creditLimit: "5000.00",
    },
    suppliers: {
      ...base,
      supplierCode: "SUP-000001",
      openingBalanceType: "PAYABLE",
      bankName: "Test Bank",
      accountHolderName: "Test Account",
      accountNumber: "123456789012",
      ifsc: "ABCD0123456",
      upiId: "test@bank",
    },
  };
  const state = {
    error: false,
    slow: false,
    empty: false,
    requests: [],
    records,
    id,
  };
  state.respond = async (url, request) => {
    const kind = url.pathname.split("/")[3];
    if (!(kind in records)) return null;
    if (request.method === "OPTIONS") return { code: 204, body: {} };
    state.requests.push({
      path: url.pathname,
      query: url.search,
      method: request.method,
    });
    if (state.slow) await new Promise((r) => setTimeout(r, 600));
    if (state.error)
      return {
        code: 503,
        body: { message: "Test internal error must not appear" },
      };
    const profile = records[kind];
    if (request.method === "POST" || request.method === "PATCH") {
      const data = JSON.parse(request.postData ?? "{}");
      assert.equal(data.businessId, undefined);
      if (data.displayName === "Duplicate")
        return {
          code: 409,
          body: { message: "This GSTIN already exists in your business" },
        };
      Object.assign(
        profile,
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]),
        ),
      );
      return { code: request.method === "POST" ? 201 : 200, body: { profile } };
    }
    if (request.method === "DELETE") {
      profile.isActive = false;
      return { code: 200, body: { profile } };
    }
    if (url.pathname.endsWith("/" + kind)) {
      const safe = Object.fromEntries(Object.entries(profile).filter(([field]) =>
        !["bankName", "accountHolderName", "accountNumber", "ifsc", "upiId"].includes(field)));
      return {
        code: 200,
        body: {
          items: state.empty ? [] : [safe],
          page: Number(url.searchParams.get("page") ?? 1),
          pageSize: 20,
          total: state.empty ? 0 : 21,
          totalPages: state.empty ? 0 : 2,
        },
      };
    }
    return {
      code: 200,
      body: {
        profile,
        summary: { totalSales: null, outstanding: null },
        dataStatus: "not_available",
        ledgerEntries: [],
        activity: [],
      },
    };
  };
  return state;
}
export async function runPartiesSmoke({
  send,
  evaluate,
  navigate,
  key,
  until,
  artifacts,
  fixtures,
}) {
  const input = async (name, value) => {
    await evaluate(
      "document.querySelector(" +
        JSON.stringify('[name="' + name + '"]') +
        ").focus();document.querySelector(" +
        JSON.stringify('[name="' + name + '"]') +
        ").select()",
    );
    await send("Input.insertText", { text: value });
  };
  const click = async (text) =>
    evaluate(
      'Array.from(document.querySelectorAll("button")).find(b=>b.textContent===' +
        JSON.stringify(text) +
        ").click()",
    );
  const ready = async (selector) =>
    until(
      () =>
        evaluate(
          "Boolean(document.querySelector(" + JSON.stringify(selector) + "))",
        ),
      "ready " + selector,
    );
  for (const kind of ["customers", "suppliers"]) {
    for (const width of [1440, 1024, 768, 375]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const [suffix, selector] of [
        ["", "table"],
        ["/new", "input[name=displayName]"],
        ["/" + fixtures.id, "button[aria-pressed]"],
        ["/" + fixtures.id + "/edit", "input[name=displayName]"],
      ]) {
        await navigate("/" + kind + suffix);
        await ready(selector);
        assert.equal(
          await evaluate("document.documentElement.scrollWidth<=innerWidth"),
          true,
          kind + suffix + " overflow " + width,
        );
        assert.equal(
          await evaluate(
            'document.querySelector("main").scrollWidth<=document.querySelector("main").clientWidth',
          ),
          true,
        );
        assert.ok(
          await evaluate(
            'Boolean(document.querySelector("a[href=\\"/' +
              kind +
              '\\"][aria-current=page]"))',
          ),
        );
        if (suffix === "" || suffix === "/new") {
          const shot = await send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
          });
          await writeFile(
            join(
              artifacts,
              kind + (suffix ? "-form" : "-list") + "-" + width + ".png",
            ),
            Buffer.from(shot.data, "base64"),
          );
        }
      }
      await navigate("/" + kind + "/" + fixtures.id);
      await ready("button[aria-pressed]");
      await click("Deactivate");
      await ready("dialog[open]");
      assert.equal(
        await evaluate(
          'document.querySelector("dialog[open]").contains(document.activeElement)',
        ),
        true,
      );
      await key("Tab");
      await key("Tab");
      assert.equal(
        await evaluate(
          'document.querySelector("dialog[open]").contains(document.activeElement)',
        ),
        true,
      );
      await key("Escape");
      await until(
        () => evaluate('!document.querySelector("dialog[open]")'),
        "dialog closed",
      );
      await until(
        () => evaluate('document.activeElement.textContent === "Deactivate"'),
        "dialog focus restoration",
      );
      console.log("PASS " + kind + " list/new/detail/edit/dialog at " + width);
    }
    await navigate("/" + kind + "/new");
    await ready("input[name=displayName]");
    await click("Save " + (kind === "customers" ? "customer" : "supplier"));
    await ready("[aria-invalid=true]");
    await until(
      () => evaluate('document.activeElement.name === "displayName"'),
      "validation focus",
    );
    for (const [name, value] of Object.entries({
      displayName: "Created in browser fixture",
      phone: "9876543210",
      addressLine1: "20 Test Street",
      city: "Pune",
      state: "Maharashtra",
      stateCode: "27",
      pincode: "411001",
      openingBalance: "100.25",
    }))
      await input(name, value);
    if (kind === "suppliers")
      for (const [name, value] of Object.entries({
        bankName: "Test Bank",
        accountHolderName: "Test Account",
        accountNumber: "123456789012",
        ifsc: "ABCD0123456",
      }))
        await input(name, value);
    await click("Save " + (kind === "customers" ? "customer" : "supplier"));
    await ready("button[aria-pressed]");
    assert.ok(
      await evaluate('document.body.innerText.includes("saved successfully")'),
    );
    assert.equal(fixtures.records[kind].openingBalance, "100.25");
    await navigate("/" + kind + "/" + fixtures.id + "/edit");
    await ready("input[name=displayName]");
    await input("displayName", "Duplicate");
    await click("Save " + (kind === "customers" ? "customer" : "supplier"));
    await until(
      () =>
        evaluate('document.body.innerText.includes("GSTIN already exists")'),
      "duplicate conflict",
    );
    await input("displayName", "Updated fixture");
    await click("Save " + (kind === "customers" ? "customer" : "supplier"));
    await ready("button[aria-pressed]");
    if (kind === "suppliers") {
      assert.equal(
        await evaluate('document.body.innerText.includes("123456789012")'),
        false,
      );
      assert.ok(await evaluate('document.body.innerText.includes("9012")'));
    }
    await click("Ledger");
    assert.ok(
      await evaluate('document.body.innerText.includes("No ledger entries")'),
    );
    await click("Deactivate");
    await click("Confirm deactivation");
    await until(
      () => evaluate('document.body.innerText.includes("Reactivate")'),
      "deactivated",
    );
    await click("Reactivate");
    await click("Confirm reactivation");
    await until(
      () => evaluate('document.body.innerText.includes("Deactivate")'),
      "reactivated",
    );
    await navigate("/" + kind);
    await ready("table");
    await input("search", "Market");
    await click("Apply filters");
    await until(
      () => evaluate('location.search.includes("search=Market")'),
      "search query",
    );
    await ready("table");
    await click("Next");
    await until(
      () => evaluate('location.search.includes("page=2")'),
      "pagination",
    );
    fixtures.empty = true;
    await navigate("/" + kind);
    await until(
      () =>
        evaluate('document.body.innerText.includes("No ' + kind + ' found")'),
      "empty state",
    );
    fixtures.empty = false;
    fixtures.error = true;
    await navigate("/" + kind);
    await until(
      () => evaluate('document.body.innerText.includes("We could not load")'),
      "error state",
    );
    assert.equal(
      await evaluate('document.body.innerText.includes("Test internal error")'),
      false,
    );
    fixtures.error = false;
    await click("Try again");
    await ready("table");
    fixtures.slow = true;
    await navigate("/" + kind);
    await ready('[aria-label="Loading records"]');
    await ready("table");
    fixtures.slow = false;
    console.log(
      "PASS " +
        kind +
        " validation/create/edit/conflict/status/search/pagination/empty/error/loading",
    );
  }
}
