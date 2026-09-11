import { describe, expect, it } from 'vitest';
// @ts-ignore the architecture checker is a plain Node script exercised directly by npm run architecture:check.
import { checkArchitectureImports } from '../../scripts/architecture-check.mjs';

describe('architecture boundary check', () => {
  it('passes valid Clean Architecture imports', () => {
    const violations = checkArchitectureImports([
      { path: 'platform/application/context/use-case.ts', source: "import { DomainError } from '../../domain/errors/domain-error.js';" },
      { path: 'platform/infrastructure/persistence/repo.ts', source: "import type { ApplicationPort } from '../../application/ports/ports.js';" },
      { path: 'platform/presentation/http/controller.ts', source: "import { createRequestContext } from '../../application/context/request-context.js';" },
    ]);

    expect(violations).toEqual([]);
  });

  it('detects forbidden domain and application dependencies', () => {
    const violations = checkArchitectureImports([
      { path: 'platform/domain/entities/bad.ts', source: "import { Injectable } from '@nestjs/common';\nimport '../../infrastructure/repo.js';" },
      { path: 'platform/application/use-cases/bad.ts', source: "import '../../presentation/http/controller.js';" },
    ]);

    expect(violations).toEqual([
      'platform/domain/entities/bad.ts: domain must not import @nestjs/common',
      'platform/domain/entities/bad.ts: domain must not import infrastructure',
      'platform/application/use-cases/bad.ts: application must not import presentation',
    ]);
  });
});
