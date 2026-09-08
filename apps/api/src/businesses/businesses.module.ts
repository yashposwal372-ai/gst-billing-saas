import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [BusinessesController], providers: [BusinessesService] })
export class BusinessesModule {}
