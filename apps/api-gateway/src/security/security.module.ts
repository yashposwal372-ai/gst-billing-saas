import { Module } from '@nestjs/common';
import { IdentityPropagationService } from './identity-propagation.service.js';

@Module({ providers: [IdentityPropagationService], exports: [IdentityPropagationService] })
export class SecurityModule {}
