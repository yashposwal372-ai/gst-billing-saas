import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const sourceRoot = new URL('../src/', import.meta.url);
const repoRoot = new URL('../../../', import.meta.url);
const checkedRoots = ['platform'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;

const domainForbiddenPackages = [/^@nestjs\//, /^@prisma\//, /^ioredis$/, /^bullmq$/, /^kafkajs$/];
const applicationForbiddenPackages = [/^@nestjs\/common$/];

function normalized(path) {
  return path.split(sep).join('/');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (sourceExtensions.has(extname(entry.name)) && !entry.name.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

function layerOf(relativePath) {
  const parts = normalized(relativePath).split('/');
  const index = parts.findIndex((part) => ['domain', 'application', 'infrastructure', 'presentation'].includes(part));
  return index >= 0 ? parts[index] : null;
}

function importedLayer(importPath, fromRelativePath) {
  if (!importPath.startsWith('.')) return null;
  const fromParts = normalized(fromRelativePath).split('/');
  fromParts.pop();
  for (const segment of importPath.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') fromParts.pop();
    else fromParts.push(segment);
  }
  return layerOf(fromParts.join('/'));
}

export function checkArchitectureImports(files) {
  const violations = [];
  for (const file of files) {
    const layer = layerOf(file.path);
    const contract = file.path.startsWith('packages/contracts/');
    if (!layer && !contract) continue;
    importPattern.lastIndex = 0;
    let match;
    while ((match = importPattern.exec(file.source)) !== null) {
      const importPath = match[1] ?? match[2];
      if (contract && (!importPath.startsWith('./') || /(?:domain|infrastructure|controller|service|generated|prisma)/i.test(importPath))) {
        violations.push(`${file.path}: contracts must contain local transport types only, not ${importPath}`);
      }
      if (file.path.startsWith('apps/api-gateway/') && (/apps\/api\/src/.test(importPath) || /(?:^|\/)api\/src(?:\/|$)/.test(importPath))) {
        violations.push(`${file.path}: api-gateway must not import apps/api implementation source ${importPath}`);
      }
      const targetLayer = importedLayer(importPath, file.path);
      if (layer === 'domain') {
        if (domainForbiddenPackages.some((pattern) => pattern.test(importPath))) {
          violations.push(`${file.path}: domain must not import ${importPath}`);
        }
        if (targetLayer === 'infrastructure' || targetLayer === 'presentation') {
          violations.push(`${file.path}: domain must not import ${targetLayer}`);
        }
      }
      if (layer === 'application') {
        if (applicationForbiddenPackages.some((pattern) => pattern.test(importPath))) {
          violations.push(`${file.path}: application must not import ${importPath}`);
        }
        if (targetLayer === 'infrastructure' || targetLayer === 'presentation') {
          violations.push(`${file.path}: application must not import ${targetLayer}`);
        }
      }
    }
  }
  return violations;
}

export async function collectCheckedSourceFiles(rootUrl = sourceRoot) {
  const rootPath = rootUrl.pathname.replace(/^\/(.:\/)/, '$1');
  const files = [];
  for (const checkedRoot of checkedRoots) {
    const dir = join(rootPath, checkedRoot);
    try {
      if (!(await stat(dir)).isDirectory()) continue;
      for (const file of await walk(dir)) {
        files.push({ path: normalized(relative(rootPath, file)), source: await readFile(file, 'utf8') });
      }
    } catch {
      continue;
    }
  }
  const contractsDir = new URL('packages/contracts/', repoRoot);
  try {
    const contractsPath = contractsDir.pathname.replace(/^\/(.:\/)/, '$1');
    for (const file of await walk(contractsPath)) {
      files.push({ path: 'packages/contracts/' + normalized(relative(contractsPath, file)), source: await readFile(file, 'utf8') });
    }
    const manifest = JSON.parse(await readFile(new URL('package.json', contractsDir), 'utf8'));
    if (Object.keys(manifest.dependencies ?? {}).length || Object.keys(manifest.peerDependencies ?? {}).length) throw new Error('contracts must have no runtime/framework dependencies');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const gatewayDir = new URL('apps/api-gateway/', repoRoot);
  try {
    const gatewayPath = gatewayDir.pathname.replace(/^\/(.:\/)/, '$1');
    for (const file of await walk(gatewayPath)) {
      files.push({ path: 'apps/api-gateway/' + normalized(relative(gatewayPath, file)), source: await readFile(file, 'utf8') });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('architecture-check.mjs')) {
  const violations = checkArchitectureImports(await collectCheckedSourceFiles());
  if (violations.length) {
    console.error('Architecture boundary violations:');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log('Architecture boundary check passed. Legacy monolith modules are excluded until migrated.');
}
