import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { '@gst/security-context': resolve(import.meta.dirname, '../../packages/security-context/src/index.ts') } },
  test: { environment: 'node', globals: true, include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] },
});
