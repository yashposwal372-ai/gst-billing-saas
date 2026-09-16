import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@gst/prisma-client/client';
import { validatePartyState } from './party-address.js';
import type { CustomerCommand, PartyCommand, PartyListQuery } from '@gst/party-contracts';

export type PartyScope = Readonly<{ userId: string; businessId: string }>;

export function scopeWhere(scope: PartyScope) {
  return { businessId: scope.businessId };
}

export function defined<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function required(value: string | undefined, field: string): string {
  if (!value) throw new BadRequestException(field + ' is required');
  return value;
}

export function partyData(dto: PartyCommand, defaultDirection: 'RECEIVABLE' | 'PAYABLE') {
  const stateCode = required(dto.stateCode, 'stateCode');
  validatePartyState(required(dto.state, 'state'), stateCode);
  if (dto.gstRegistered) {
    const gstin = required(dto.gstin, 'gstin');
    if (gstin.slice(0, 2) !== stateCode) throw new BadRequestException('GSTIN state code must match address state code');
    if (dto.pan && dto.pan !== gstin.slice(2, 12)) throw new BadRequestException('PAN must match GSTIN');
  } else if (dto.gstin) throw new BadRequestException('Omit GSTIN when GST registration is disabled');
  return {
    displayName: required(dto.displayName, 'displayName'),
    businessName: dto.businessName || null,
    contactPerson: dto.contactPerson || null,
    gstRegistered: dto.gstRegistered ?? false,
    gstin: dto.gstin || null,
    pan: dto.pan || (dto.gstin ? dto.gstin.slice(2, 12) : null),
    phone: required(dto.phone, 'phone'),
    whatsappNumber: dto.whatsappNumber || null,
    email: dto.email || null,
    addressLine1: required(dto.addressLine1, 'addressLine1'),
    addressLine2: dto.addressLine2 || null,
    city: required(dto.city, 'city'),
    state: required(dto.state, 'state'),
    stateCode,
    pincode: required(dto.pincode, 'pincode'),
    openingBalance: new Prisma.Decimal(dto.openingBalance ?? '0'),
    openingBalanceType: dto.openingBalanceType ?? defaultDirection,
    paymentTermsDays: dto.paymentTermsDays ?? 0,
    notes: dto.notes || null,
    isActive: dto.isActive ?? true,
  };
}

export function customerData(dto: CustomerCommand) {
  return { ...partyData(dto, 'RECEIVABLE'), customerType: dto.customerType ?? 'INDIVIDUAL', shippingSameAsBilling: dto.shippingSameAsBilling ?? true, shippingAddressLine1: dto.shippingAddressLine1 || null, shippingAddressLine2: dto.shippingAddressLine2 || null, shippingCity: dto.shippingCity || null, shippingState: dto.shippingState || null, shippingStateCode: dto.shippingStateCode || null, shippingPincode: dto.shippingPincode || null, creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : null };
}

export function listWhere(query: PartyListQuery) {
  return {
    ...(query.status === 'all' ? {} : { isActive: query.status === 'active' }),
    ...(query.gstRegistered === 'all' ? {} : { gstRegistered: query.gstRegistered === 'true' }),
    ...(query.state ? { state: { equals: query.state, mode: 'insensitive' as const } } : {}),
  };
}

export function rethrowParty(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This GSTIN or party code already exists in your business');
  throw error;
}

export function editable(record: object) {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v instanceof Prisma.Decimal ? v.toFixed(2) : v === null ? '' : v]));
}

export const partyListSelect = { id: true, displayName: true, businessName: true, phone: true, email: true, gstRegistered: true, gstin: true, state: true, stateCode: true, openingBalance: true, openingBalanceType: true, isActive: true, createdAt: true, updatedAt: true } as const;

export function serialize<T extends { openingBalance: Prisma.Decimal; createdAt?: Date; updatedAt?: Date; creditLimit?: Prisma.Decimal | null }>(row: T) {
  return { ...row, openingBalance: row.openingBalance.toFixed(2), ...(row.creditLimit instanceof Prisma.Decimal ? { creditLimit: row.creditLimit.toFixed(2) } : {}), ...(row.createdAt instanceof Date ? { createdAt: row.createdAt.toISOString() } : {}), ...(row.updatedAt instanceof Date ? { updatedAt: row.updatedAt.toISOString() } : {}) };
}
