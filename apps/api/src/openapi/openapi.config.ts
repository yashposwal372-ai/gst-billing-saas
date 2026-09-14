import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { createOpenApiDocument } from './openapi-document.js';

export function configureOpenApi(app: INestApplication): void {
  if (app.get(ConfigService).get('NODE_ENV') === 'production') return;
  SwaggerModule.setup('api/docs', app, () => createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
    raw: ['json'],
    swaggerOptions: { supportedSubmitMethods: [], persistAuthorization: false },
  });
}
