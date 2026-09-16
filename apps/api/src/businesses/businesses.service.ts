import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '@gst/prisma-client/client';
import type { SafeUser } from '../users/user.select.js';
import type { BusinessDto } from './dto/business.dto.js';
import { validateBusiness } from './business.validation.js';

@Injectable()
export class BusinessesService {
  constructor(private readonly db: DatabaseService) {}
  private data(dto: BusinessDto) {
    validateBusiness(dto);
    return {
      name: dto.name, tradeName: dto.tradeName ?? null, ownerName: dto.ownerName,
      businessType: dto.businessType, gstRegistered: dto.gstRegistered, gstin: dto.gstin ?? null,
      pan: dto.pan ?? (dto.gstRegistered ? dto.gstin!.slice(2, 12) : null),
      mobile: dto.mobile, email: dto.email, addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null, state: dto.state, stateCode: dto.stateCode,
      city: dto.city, pincode: dto.pincode, invoicePrefix: dto.invoicePrefix,
      financialYear: dto.financialYear, gstMode: dto.gstMode,
      bankName: dto.bankName ?? null, accountHolder: dto.accountHolder ?? null,
      accountNumber: dto.accountNumber ?? null, ifsc: dto.ifsc ?? null, upiId: dto.upiId ?? null,
    };
  }
  private rethrow(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new ConflictException('A business with this GSTIN already exists');
    throw error;
  }
  async create(user: SafeUser, dto: BusinessDto) {
    const data = this.data(dto);
    if (user.currentBusinessId) throw new ConflictException('Business onboarding is already complete');
    try {
      return await this.db.$transaction(async (tx) => {
        const business = await tx.business.create({ data: { ...data, onboardingCompletedAt: new Date(),
          memberships: { create: { userId: user.id, role: 'OWNER' } } } });
        const assigned = await tx.user.updateMany({ where: { id: user.id, currentBusinessId: null, status: 'ACTIVE' },
          data: { currentBusinessId: business.id } });
        if (assigned.count !== 1) throw new ConflictException('Business onboarding is already complete');
        return business;
      });
    } catch (error) { this.rethrow(error); }
  }
  async current(user: SafeUser) {
    if (!user.currentBusinessId) return null;
    const membership = await this.db.businessMember.findUnique({
      where: { userId_businessId: { userId: user.id, businessId: user.currentBusinessId } },
      include: { business: true },
    });
    if (!membership || membership.role !== 'OWNER') throw new ForbiddenException('Business owner access required');
    return membership.business;
  }
  async update(user: SafeUser, dto: BusinessDto) {
    const data = this.data(dto);
    if (!user.currentBusinessId) throw new ForbiddenException('Business owner access required');
    try {
      return await this.db.$transaction(async (tx) => {
        // Authorization and write share a transaction; client-provided tenant IDs are never used.
        const updated = await tx.business.updateMany({
          where: { id: user.currentBusinessId!, memberships: { some: { userId: user.id, role: 'OWNER' } } },
          data,
        });
        if (updated.count !== 1) throw new ForbiddenException('Business owner access required');
        return tx.business.findUniqueOrThrow({ where: { id: user.currentBusinessId! } });
      });
    } catch (error) { this.rethrow(error); }
  }
}
