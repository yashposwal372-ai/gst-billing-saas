import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../../../', import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const openapi = JSON.parse(await readFile(new URL('docs/openapi/api-v1.json', repoRoot), 'utf8'));
const errors = [];
const operationPaths = Object.keys(openapi.paths ?? {});
for (const path of operationPaths) {
  if (!(path === '/api/v1' || path.startsWith('/api/v1/'))) errors.push(`OpenAPI path is outside gateway proxy coverage: ${path}`);
}
if (!operationPaths.length) errors.push('No OpenAPI paths found');
let operations = 0;
for (const item of Object.values(openapi.paths ?? {})) {
  for (const method of Object.keys(item ?? {})) if (['get', 'post', 'patch', 'put', 'delete'].includes(method)) operations += 1;
}
if (operations !== 185) errors.push(`Expected 185 OpenAPI operations, found ${operations}`);

const configSource = await readFile(new URL('apps/api-gateway/src/config/gateway-environment.ts', repoRoot), 'utf8');
for (const expected of ['GATEWAY_PORT', 'MONOLITH_BASE_URL', 'PROXY_TIMEOUT_MS', 'http://127.0.0.1:4000', '4100']) {
  if (!configSource.includes(expected)) errors.push(`Gateway config missing ${expected}`);
}
const proxySource = await readFile(new URL('apps/api-gateway/src/proxy/proxy.service.ts', repoRoot), 'utf8');
for (const expected of ['/api/v1', 'x-gst-internal-', 'x-internal-', 'x-request-id', 'x-correlation-id', 'UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE']) {
  if (!proxySource.includes(expected)) errors.push(`Gateway proxy policy missing ${expected}`);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(ts|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}
const gatewayRoot = join(repoRootPath, 'apps/api-gateway');
for (const file of await walk(gatewayRoot)) {
  const source = await readFile(file, 'utf8');
  if (/from ['"](?:\.\.\/){2,}api\//.test(source) || /from ['"]apps\/api\/src/.test(source)) errors.push(`Gateway imports apps/api implementation source: ${file}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Gateway check passed: ${operations} OpenAPI operations covered by /api/v1 proxy; no open proxy or forbidden implementation imports detected.`);
