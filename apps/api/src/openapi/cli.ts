import 'reflect-metadata';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  canonical,
  contractDocument,
  metadata,
  operationId,
} from './openapi-document.js';
import { assertSnapshotMatches, validateOpenApi } from './openapi-check.js';

// Contract generation is source-driven and deliberately does not construct Nest.
// Registered route and guard coverage is checked separately by the runtime docs test.
const document = contractDocument();
validateOpenApi(document);
const output = canonical(document);
const directory = new URL('../../../../docs/openapi/', import.meta.url);
const snapshot = new URL('api-v1.json', directory);
const inventory =
  '# Current public route inventory\n\nGenerated from controller decorators and DTO source metadata. Runtime documentation setup separately verifies the routes and guards registered by Nest. Documentation routes are not part of `/api/v1`. Lifecycle routes can reject unsupported transitions.\n\n| Method | Path | Operation ID | Access | Source |\n| --- | --- | --- | --- | --- |\n' +
  [...metadata.routes]
    .sort((a, b) =>
      `${a.path} ${a.verb}`.localeCompare(`${b.path} ${b.verb}`, 'en'),
    )
    .map(
      (r) =>
        `| ${r.verb.toUpperCase()} | \`${r.path}\` | \`${operationId(r.path, r.verb)}\` | ${r.protected ? 'Access cookie' : r.path.endsWith('/auth/refresh') ? 'Refresh cookie' : 'Public'}${r.csrf ? '; Origin + CSRF' : ''} | ${r.source} |`,
    )
    .join('\n') +
  '\n';
if (process.argv.includes('--check')) {
  assertSnapshotMatches(output, await readFile(snapshot, 'utf8'));
  assertSnapshotMatches(
    inventory,
    await readFile(new URL('routes.md', directory), 'utf8'),
  );
  console.log(
    `OpenAPI check passed: ${metadata.routes.length} operations; source route coverage, IDs, references, request schemas and snapshot match.`,
  );
} else {
  await mkdir(directory, { recursive: true });
  await writeFile(snapshot, output);
  await writeFile(new URL('routes.md', directory), inventory);
  console.log(
    `Generated docs/openapi/api-v1.json and routes.md (${metadata.routes.length} operations).`,
  );
}
