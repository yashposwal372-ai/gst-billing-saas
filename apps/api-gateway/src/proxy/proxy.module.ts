import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module.js';
import { ProxyService } from './proxy.service.js';

@Module({ imports: [SecurityModule], providers: [ProxyService], exports: [ProxyService] })
export class ProxyModule {}
