import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const serviceRoot = join(repoRoot, 'apps/party-service');
const errors = [];
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'dist', '.turbo', 'coverage'].includes(entry.name)) files.push(...await walk(full)); }
    else if (/\.(ts|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}
const all = await walk(serviceRoot);
const sources = new Map();
for (const file of all) sources.set(relative(serviceRoot, file).split(sep).join('/'), await readFile(file, 'utf8'));
for (const expected of ['internal/v1/party/customers', 'internal/v1/party/suppliers', 'PARTY_SERVICE_CONTEXT_SOURCE', 'PARTY_SERVICE_CONTEXT_AUDIENCE', 'requireBusinessId: true', 'X-GST-Internal-Context', 'X-GST-Internal-Signature']) {
  if (![...sources.values()].some((source) => source.includes(expected))) errors.push(`Missing invariant ${expected}`);
}
for (const [file, source] of sources) {
  if (file === 'scripts/party-service-check.mjs') continue;
  if (/gst_access|refresh|JWT_SECRET|AuthGuard|BrowserWriteGuard|x-gst-internal-business-id|X-Business-ID|ioredis|bullmq/i.test(source)) errors.push(`Forbidden public auth/cache dependency in ${file}`);
  if (/apps\/api\/src\/(?!generated\/prisma)/.test(source)) errors.push(`party-service imports monolith implementation source in ${file}`);
  if (/retry/i.test(source) && !file.endsWith('party-service-check.mjs')) errors.push(`Retry policy reference in ${file}`);
}
const monolithParty = await readFile(join(repoRoot, 'apps/api/src/party/party.module.ts'), 'utf8');
if (!monolithParty.includes('HttpPartyServiceClient') || /PrismaCustomerRepository|PrismaSupplierRepository/.test(monolithParty)) errors.push('Monolith PartyModule must wire only the remote HTTP client');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Party service check passed: internal routes, service context, no public JWT/cookie auth, no retry policy, and monolith remote-client wiring verified.');
