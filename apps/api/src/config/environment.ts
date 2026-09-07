import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsString()
  DATABASE_URL: string =
    'postgresql://gst_dev:gst_dev_local@localhost:5432/gst_billing';

  @IsString()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const config = plainToInstance(
    Environment,
    Object.fromEntries(
      Object.entries(input).filter(([key]) =>
        Object.hasOwn(new Environment(), key),
      ),
    ),
  );
  const invalid = new Set(validateSync(config).map((error) => error.property));
  for (const [key, protocols] of [
    ['FRONTEND_URL', ['http:', 'https:']],
    ['DATABASE_URL', ['postgres:', 'postgresql:']],
    ['REDIS_URL', ['redis:', 'rediss:']],
  ] as const) {
    try {
      const url = new URL(config[key]);
      if (
        !(protocols as readonly string[]).includes(url.protocol) ||
        !url.hostname
      )
        invalid.add(key);
      if (
        key === 'FRONTEND_URL' &&
        (url.origin !== config[key] || url.username || url.password)
      )
        invalid.add(key);
    } catch {
      invalid.add(key);
    }
  }
  if (config.NODE_ENV === 'production') {
    for (const key of ['FRONTEND_URL', 'DATABASE_URL', 'REDIS_URL'] as const) {
      if (!input[key] || input[key] === new Environment()[key])
        invalid.add(key);
    }
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const value = config[key];
      if (
        !value ||
        value.length < 32 ||
        /placeholder|change.me|replace/i.test(value)
      )
        invalid.add(key);
    }
    if (config.JWT_SECRET === config.JWT_REFRESH_SECRET)
      invalid.add('JWT_REFRESH_SECRET');
    if (!config.FRONTEND_URL.startsWith('https://'))
      invalid.add('FRONTEND_URL');
  }
  if (invalid.size)
    throw new Error(
      'Invalid environment variables: ' + [...invalid].join(', '),
    );
  return config;
}
