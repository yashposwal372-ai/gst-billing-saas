// Standalone browser smoke check using Node 24 + installed Chrome/Edge, no test dependency.
// API interception below is test-only. This does not verify real authentication or persistence.
import assert from 'node:assert/strict';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueFixtures, runCatalogueSmoke } from './catalogue-smoke.mjs';
import { createPartyFixtures, runPartiesSmoke } from './parties-smoke.mjs';
import { createInvoiceFixtures, runInvoiceSmoke } from './invoice-smoke.mjs';
import { createPhase7Fixtures, runPhase7Smoke } from './phase7-smoke.mjs';
import { createPhase8Fixtures, runPhase8Smoke } from './phase8-smoke.mjs';
import { createGstReportFixtures, runGstReportsSmoke } from './gst-reports-smoke.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const browserPath = process.argv.slice(2).find(arg => !['--parties','--catalogue','--invoices','--phase7','--phase8','--gst-reports'].includes(arg)) ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const partyMode = process.argv.includes('--parties');
const partyFixtures = createPartyFixtures();
const catalogueMode=process.argv.includes("--catalogue");
const catalogueFixtures=createCatalogueFixtures();
const invoiceMode=process.argv.includes("--invoices");
const invoiceFixtures=createInvoiceFixtures();
const phase7Mode=process.argv.includes("--phase7");
const phase7Fixtures=createPhase7Fixtures();
const phase8Mode=process.argv.includes("--phase8");
const phase8Fixtures=createPhase8Fixtures();
const gstReportsMode=process.argv.includes("--gst-reports");
const gstReportFixtures=createGstReportFixtures();
const artifacts = await mkdtemp(join(tmpdir(), 'gst-dashboard-smoke-'));
const origin = 'http://localhost:3000';
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(check, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { const result = await check(); if (result) return result; } catch { /* Startup/loading */ }
    await delay(100);
  }
  throw new Error('Timed out: ' + label);
}
// Refuse to use or stop an existing frontend process.
let existing = false;
try { existing = Boolean(await fetch(origin, { signal: AbortSignal.timeout(1000) })); } catch { /* Port free */ }
assert.equal(existing, false, 'Port 3000 must be free for this test');
const web = spawn(process.execPath, [resolve(webRoot, '../../node_modules/next/dist/bin/next'), 'start', '--port', '3000'], { cwd: webRoot, windowsHide: true, stdio: 'ignore' });
let browser; let socket;
try {
  await until(async () => (await fetch(origin)).ok, 'frontend startup');
  browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + join(artifacts, 'profile'), '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', (error) => { console.error('Browser launch failed:', error.code); });
  const endpoint = await until(async () => {
    const [port, path] = (await readFile(join(artifacts, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
    return 'ws://127.0.0.1:' + port + path;
  }, 'browser debugging endpoint');
  socket = new WebSocket(endpoint);
  await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
  let id = 0; let sessionId;
  const pending = new Map(); const pageErrors = []; const requestedFilters = [];
  function send(method, params = {}, session = sessionId) {
    return new Promise((done, reject) => {
      const callId = ++id;
      const timeout = setTimeout(() => { pending.delete(callId); reject(new Error('CDP timeout: ' + method)); }, 15000);
      pending.set(callId, { done: (value) => { clearTimeout(timeout); done(value); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
      socket.send(JSON.stringify({ id: callId, method, params, ...(session ? { sessionId: session } : {}) }));
    });
  }
  let signedIn = true; let noBusiness = false; let summaryError = false; let slowSummary = false; let logoutCalled = false;
  const testUser = { id: 'ui-test-owner', firstName: 'Aarav', lastName: 'Shah', email: 'owner@example.test', mobile: null, emailVerifiedAt: null, currentBusinessId: 'ui-test-business' };
  const metricKeys = ['todaySales', 'monthlySales', 'totalSales', 'totalPurchases', 'totalExpenses', 'totalGst', 'receivables', 'payables', 'customers', 'suppliers', 'products', 'lowStock', 'overdueInvoices'];
  socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id); pending.delete(message.id);
      if (message.error) callback?.reject(new Error(message.error.message)); else callback?.done(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params; const url = new URL(request.url);
      let code = 200; let body = {};
      const partyResponse = gstReportsMode ? await gstReportFixtures.respond(url, request) : phase8Mode ? await phase8Fixtures.respond(url, request) : phase7Mode ? await phase7Fixtures.respond(url, request) : invoiceMode ? await invoiceFixtures.respond(url, request) : await catalogueFixtures.respond(url, request) ?? await partyFixtures.respond(url, request);
      if (partyResponse) { code = partyResponse.code; body = partyResponse.body; }
      else if (url.pathname.endsWith('/auth/me')) { code = signedIn ? 200 : 401; body = { user: { ...testUser, currentBusinessId: noBusiness ? null : testUser.currentBusinessId } }; }
      else if (url.pathname.endsWith('/auth/logout')) { signedIn = false; logoutCalled = true; body = { status: 'ok' }; }
      else if (url.pathname.endsWith('/auth/refresh')) { code = signedIn ? 200 : 401; }
      else if (url.pathname.endsWith('/dashboard/summary')) {
        if (slowSummary) await delay(800);
        requestedFilters.push(url.search);
        code = summaryError ? 503 : 200;
        body = summaryError ? { message: 'Internal test error must not be displayed' } : {
          business: { id: 'ui-test-business', name: 'Shah & Sons Trading Company â€” A deliberately long business name for responsive layout verification', role: 'OWNER', onboardingCompleted: true },
          dataStatus: 'not_available', filter: { period: url.searchParams.get('period') ?? 'thisMonth', start: url.searchParams.get('start'), end: url.searchParams.get('end'), timezone: 'Asia/Kolkata' },
          metrics: Object.fromEntries(metricKeys.map((key) => [key, ['customers','suppliers','products','lowStock'].includes(key) ? 1 : ['todaySales','monthlySales','totalPurchases','totalExpenses','receivables','payables'].includes(key) ? '1.00' : null])), recentActivity: [], charts: { sales: [], gst: [], invoiceStatus: [], paymentMethods: [], topProducts: [] },
        };
      } else if (url.pathname.endsWith('/businesses/current')) body = { business: null };
      else { code = 404; }
      try { await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : code,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type, X-CSRF-Protection' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' }],
        body: request.method === 'OPTIONS' ? '' : Buffer.from(JSON.stringify(body)).toString('base64'),
      }); } catch { /* Browser may be closing */ }
    }
  };
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:4000/api/v1/*' }] });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = (path) => send('Page.navigate', { url: origin + path });
  const ready = () => until(() => evaluate('document.body.innerText.includes("Your story starts here")'), 'dashboard content');
  const key = async (key, code = key) => {
    const windowsVirtualKeyCode = key === 'Escape' ? 27 : key === 'Tab' ? 9 : 13;
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  };
  if (gstReportsMode) await runGstReportsSmoke({send,evaluate,navigate,key,until,artifacts,fixtures:gstReportFixtures}).catch(async error=>{console.error(await evaluate("document.body.innerText"));throw error;});
  else if (phase8Mode) await runPhase8Smoke({send,evaluate,navigate,key,until,artifacts,fixtures:phase8Fixtures}).catch(async error=>{console.error(await evaluate("document.body.innerText"));throw error;});
  else if (phase7Mode) await runPhase7Smoke({send,evaluate,navigate,key,until,artifacts,fixtures:phase7Fixtures}).catch(async error=>{console.error(await evaluate("document.body.innerText"));throw error;});
  else if (invoiceMode) await runInvoiceSmoke({send,evaluate,navigate,key,until,artifacts,fixtures:invoiceFixtures}).catch(async error=>{console.error(await evaluate("document.body.innerText"));throw error;});
  else if (catalogueMode) await runCatalogueSmoke({send,evaluate,navigate,key,until,artifacts,fixtures:catalogueFixtures}).catch(async error=>{console.error(await evaluate("document.body.innerText"));throw error;});
  else if (partyMode) await runPartiesSmoke({send,evaluate,navigate,key,until,artifacts,fixtures:partyFixtures});
  else {
  for (const width of [1440, 1024, 768, 375]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/dashboard'); await ready();
    const sizes = await evaluate(`({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, mainWidth: document.querySelector('main').scrollWidth, mainClient: document.querySelector('main').clientWidth })`);
    assert.ok(sizes.documentWidth <= sizes.width, 'Document overflow at ' + width);
    assert.ok(sizes.mainWidth <= sizes.mainClient, 'Main content overflow at ' + width);
    assert.equal(await evaluate('document.querySelectorAll("main button:disabled").length'), 0);
    assert.ok(await evaluate('document.querySelector("[aria-current=page]") !== null'));
    if (width < 1200) {
      await evaluate(`document.querySelector('[aria-label="Open navigation"]').focus(); document.querySelector('[aria-label="Open navigation"]').click()`);
      assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'), true);
      await key('Tab'); assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'), true);
      await evaluate(`Array.from(document.querySelectorAll('dialog[open] summary')).find(item=>item.textContent==='Sales').click()`);
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).some(button=>button.disabled && button.textContent.includes('GST Dashboard'))`), true);
      for (let step = 0; step < 15; step++) {
        await key('Tab');
        assert.equal(await evaluate('document.querySelector("dialog[open]").contains(document.activeElement)'), true);
      }
      await key('Escape');
      await until(() => evaluate('document.querySelector("dialog[open]") === null'), 'drawer Escape');
      assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Open navigation');
      await evaluate(`document.querySelector('[aria-label="Open navigation"]').click(); document.querySelector('dialog[open] nav a').click()`);
      assert.equal(await evaluate('document.querySelector("dialog[open]") === null'), true);
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(artifacts, 'dashboard-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
    console.log('PASS layout, navigation, empty metrics:', width);
  }
  await evaluate(`document.querySelector('select').value='custom'; document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await until(() => evaluate('Boolean(document.querySelector("input[name=start]"))'), 'custom range inputs');
  await evaluate(`document.querySelector('input[name=start]').value='2026-04-01'; document.querySelector('input[name=end]').value='2026-09-08'; document.querySelector('input[name=start]').form.requestSubmit()`);
  await until(() => requestedFilters.some((query) => query.includes('start=2026-04-01') && query.includes('end=2026-09-08')), 'custom filter sent');
  await ready();
  summaryError = true; await navigate('/dashboard');
  await until(() => evaluate('document.body.innerText.includes("Letâ€™s reconnect")'), 'error state');
  assert.equal(await evaluate('document.body.innerText.includes("Internal test error")'), false);
  summaryError = false;
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Try again').click()`); await ready();
  slowSummary = true; await navigate('/dashboard');
  await until(() => evaluate(`Boolean(document.querySelector('[aria-label="Loading dashboard"]'))`), 'loading skeleton'); await ready(); slowSummary = false;
  await navigate('/login'); await ready();
  assert.equal(await evaluate('location.pathname'), '/dashboard');
  noBusiness = true; await navigate('/dashboard');
  await until(() => evaluate('location.pathname === "/onboarding"'), 'missing business redirect'); noBusiness = false;
  await navigate('/dashboard'); await ready();
  await evaluate(`document.querySelector('summary[aria-label="Open account menu"]').click()`);
  await key('Escape'); assert.equal(await evaluate(`document.querySelector('summary[aria-label="Open account menu"]').parentElement.open`), false);
  await evaluate(`document.querySelector('[aria-label="Notifications (coming soon)"]').focus(); document.querySelector('[aria-label="Notifications (coming soon)"]').click()`);
  assert.equal(await evaluate(`document.querySelector('dialog[open]').innerText.includes('Notifications are coming soon')`), true);
  await key('Escape'); await until(() => evaluate('document.querySelector("dialog[open]") === null'), 'notifications Escape');
  await evaluate(`document.querySelector('summary[aria-label="Open account menu"]').click(); Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Sign out').click()`);
  await until(() => evaluate('location.pathname === "/login"'), 'logout redirect'); assert.equal(logoutCalled, true);
  await navigate('/dashboard'); await until(() => evaluate('location.pathname === "/login"'), 'unauthenticated redirect');
  }
  const relevantPageErrors = gstReportsMode ? pageErrors.filter((error) => error !== 'Uncaught (in promise)') : phase8Mode ? pageErrors.filter((error) => error !== 'Uncaught (in promise)') : phase7Mode ? pageErrors.filter((error) => error !== "Uncaught (in promise)") : pageErrors;
  assert.deepEqual(relevantPageErrors, []);
  console.log(gstReportsMode ? 'PASS Phase 9 GST reports using test-only API fixtures' : phase8Mode ? 'PASS Phase 8 workflows using test-only API fixtures' : phase7Mode ? 'PASS Phase 7 workflows using test-only API fixtures' : invoiceMode ? 'PASS invoice workflows using test-only API fixtures' : catalogueMode ? 'PASS catalogue workflows using test-only API fixtures' : partyMode ? 'PASS party workflows using test-only API fixtures' : 'PASS custom dates, error/retry, skeleton, auth redirects, account Escape and logout');
  console.log('Test-only API fixtures used. Screenshots:', artifacts);
  await send('Browser.close', {}, null).catch(() => {});
} finally {
  socket?.close(); browser?.kill(); web.kill();
}
