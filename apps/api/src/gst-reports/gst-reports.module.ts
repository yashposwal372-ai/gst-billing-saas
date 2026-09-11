import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GstReportsController } from './gst-reports.controller.js';
import { GstReportsService } from './gst-reports.service.js';
@Module({ imports: [AuthModule, DatabaseModule], controllers: [GstReportsController], providers: [GstReportsService] })
export class GstReportsModule {}
