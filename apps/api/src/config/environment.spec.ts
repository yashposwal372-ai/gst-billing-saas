import { validateEnvironment } from './environment.js';

describe('environment validation', () => {
  it('uses local defaults without requiring infrastructure or JWT secrets', () => {
    expect(validateEnvironment({})).toMatchObject({
      PORT: 4000,
      FRONTEND_URL: 'http://localhost:3000',
    });
  });
  it('transforms ports and preserves Phase 2 placeholders', () => {
    expect(
      validateEnvironment({ PORT: '4100', JWT_SECRET: 'placeholder' }),
    ).toMatchObject({ PORT: 4100, JWT_SECRET: 'placeholder' });
  });
  it.each([
    { PORT: 'abc' },
    { PORT: '0' },
    { PORT: '65536' },
    { NODE_ENV: 'staging' },
    { FRONTEND_URL: '*' },
    { FRONTEND_URL: 'https://example.com/path' },
    { DATABASE_URL: 'https://db.example.com' },
    { REDIS_URL: 'http://localhost' },
  ])('rejects invalid configuration %j', (input) => {
    expect(() => validateEnvironment(input)).toThrow(
      'Invalid environment variables:',
    );
  });
  it('rejects missing production configuration without leaking secrets', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: 'sensitive-value',
      }),
    ).toThrow('Invalid environment variables:');
    try {
      validateEnvironment({ DATABASE_URL: 'secret-invalid-url' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-invalid-url');
    }
  });
  it('accepts explicit production configuration and distinct secrets', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        DATABASE_URL: 'postgresql://user:password@db:5432/gst',
        REDIS_URL: 'rediss://cache:6379',
        JWT_SECRET: 'a'.repeat(48),
        JWT_REFRESH_SECRET: 'b'.repeat(48),
      }).NODE_ENV,
    ).toBe('production');
  });
});
