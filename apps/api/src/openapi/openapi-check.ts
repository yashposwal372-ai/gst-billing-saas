import type { OpenAPIObject } from '@nestjs/swagger';
import type { OperationObject, SchemaObject } from '@nestjs/swagger';

export function assertSnapshotMatches(current: string, snapshot: string): void {
  if (current !== snapshot)
    throw new Error(
      'OpenAPI contract drift. For intentional API changes: run npm run openapi:generate, review the diff, run tests, and commit the updated contract snapshot. Check did not overwrite the snapshot.',
    );
}

export function validateOpenApi(doc: OpenAPIObject): void {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const [path, item] of Object.entries(doc.paths))
    for (const [verb, value] of Object.entries(item ?? {})) {
      if (
        !['get', 'post', 'patch', 'delete', 'put', 'head', 'options'].includes(
          verb,
        )
      )
        continue;
      const op = value as OperationObject;
      if (!op.operationId || ids.has(op.operationId))
        errors.push(`Missing/duplicate operation ID: ${verb} ${path}`);
      ids.add(op.operationId!);
      for (const match of path.matchAll(/\{([^}]+)\}/g))
        if (
          !op.parameters?.some(
            (p) =>
              !('$ref' in p) &&
              p.in === 'path' &&
              p.name === match[1] &&
              p.required,
          )
        )
          errors.push(`Missing required path parameter: ${path}`);
      if (op.requestBody && !('$ref' in op.requestBody)) {
        const body = op.requestBody.content['application/json']?.schema;
        const schema =
          body && '$ref' in body
            ? doc.components?.schemas?.[body.$ref.split('/').at(-1)!]
            : body;
        if (
          !schema ||
          !Object.keys((schema as SchemaObject).properties ?? {}).length
        )
          errors.push(`Empty request schema: ${path}`);
      }
    }
  function walk(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    if (typeof obj.$ref === 'string') {
      const target = obj.$ref
        .slice(2)
        .split('/')
        .reduce<unknown>(
          (v, k) =>
            v && typeof v === 'object'
              ? (v as Record<string, unknown>)[
                  k.replaceAll('~1', '/').replaceAll('~0', '~')
                ]
              : undefined,
          doc,
        );
      if (!obj.$ref.startsWith('#/') || !target)
        errors.push(`Unresolved reference: ${obj.$ref}`);
    }
    if (obj['x-unresolved-transport'])
      errors.push('Erased response type requires an explicit wire schema');
    if (
      obj.properties &&
      typeof obj.properties === 'object' &&
      [
        'absoluteValue',
        'toFixed',
        '$connect',
        '$transaction',
        'passwordHash',
        'tokenHash',
      ].some((k) => k in (obj.properties as object))
    )
      errors.push(
        'Implementation or sensitive field leaked into transport schema',
      );
    Object.values(obj).forEach(walk);
  }
  walk(doc);
  if (
    !doc.components?.schemas?.StandardError ||
    !doc.components?.schemas?.LegacyError
  )
    errors.push('Missing error compatibility schemas');
  if (!doc.components?.securitySchemes?.accessCookie)
    errors.push('Missing cookie security scheme');
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));
}
