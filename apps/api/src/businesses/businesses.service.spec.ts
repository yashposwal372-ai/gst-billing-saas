import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BusinessDto } from './dto/business.dto.js';
import { validateBusiness } from './business.validation.js';
import { BusinessesService } from './businesses.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';

export const profile: BusinessDto = { name: 'Example business', ownerName: 'Example Owner', businessType: 'PROPRIETORSHIP',
  gstRegistered: false, mobile: '9876543210', email: 'owner@example.com', addressLine1: '10 Example Street',
  state: 'Maharashtra', stateCode: '27', city: 'Pune', pincode: '411001', invoicePrefix: 'INV', financialYear: '2026-27', gstMode: 'NOT_APPLICABLE' };
describe('business validation and ownership (mocked database)', () => {
  it('accepts non-GST businesses without GSTIN or bank details', () => {
    expect(validateSync(plainToInstance(BusinessDto, profile))).toHaveLength(0);
    expect(() => validateBusiness(profile)).not.toThrow();
  });
  it.each([{ gstin: 'invalid' }, { pan: '1234' }, { pincode: '000000' }, { stateCode: '00' }, { ifsc: 'bad' }])('rejects format errors %j', (fields) => {
    expect(validateSync(plainToInstance(BusinessDto, { ...profile, ...fields })).length).toBeGreaterThan(0);
  });
  it.each([
    { financialYear: '2026-29' }, { gstRegistered: true }, { bankName: 'Partial bank' },
    { gstRegistered: true, gstin: '29ABCDE1234F1Z5', gstMode: 'EXCLUSIVE' },
    { gstRegistered: true, gstin: '27ABCDE1234F1Z5', gstMode: 'EXCLUSIVE', pan: 'ABCDE9999F' },
  ])('rejects cross-field mismatch %j', (fields) => {
    expect(() => validateBusiness({ ...profile, ...fields } as BusinessDto)).toThrow();
  });
  it('accepts PAN/GSTIN syntax and matching state/PAN without claiming official verification', () => {
    const dto = { ...profile, gstRegistered: true, gstin: '27AAACB1234C1Z5', pan: 'AAACB1234C', gstMode: 'EXCLUSIVE' as const };
    expect(validateSync(plainToInstance(BusinessDto, dto))).toHaveLength(0);
    expect(() => validateBusiness(dto)).not.toThrow();
  });
  const user = { id: 'owner', currentBusinessId: null } as SafeUser;
  function setup() {
    const db = {
      business: { create: vi.fn().mockResolvedValue({ id: 'business-a' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn() },
      businessMember: { findUnique: vi.fn() }, user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(db));
    return { db, service: new BusinessesService(db as unknown as DatabaseService) };
  }
  it('creates business and OWNER membership inside one transaction', async () => {
    const { db, service } = setup();
    await service.create(user, profile);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.business.create.mock.calls[0]![0].data.memberships).toEqual({ create: { userId: 'owner', role: 'OWNER' } });
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 'owner', currentBusinessId: null, status: 'ACTIVE' }, data: { currentBusinessId: 'business-a' } });
  });
  it('rejects a lost concurrent first-business claim so the transaction rolls back', async () => {
    const { db, service } = setup(); db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create(user, profile)).rejects.toThrow('already complete');
  });
  it('does not let an unauthorized user read another business', async () => {
    const { db, service } = setup(); db.businessMember.findUnique.mockResolvedValue(null);
    await expect(service.current({ ...user, currentBusinessId: 'business-b' })).rejects.toThrow('owner access');
    expect(db.businessMember.findUnique).toHaveBeenCalledWith({ where: { userId_businessId: { userId: 'owner', businessId: 'business-b' } }, include: { business: true } });
  });
  it('denies non-owner business profile access', async () => {
    const { db, service } = setup(); db.businessMember.findUnique.mockResolvedValue({ role: 'MEMBER', business: { id: 'business-b' } });
    await expect(service.current({ ...user, currentBusinessId: 'business-b' })).rejects.toThrow('owner access');
  });
  it('scopes updates by trusted business ID and OWNER membership', async () => {
    const { db, service } = setup(); db.business.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update({ ...user, currentBusinessId: 'business-b' }, profile)).rejects.toThrow('owner access');
    expect(db.business.updateMany.mock.calls[0]![0].where).toEqual({ id: 'business-b', memberships: { some: { userId: 'owner', role: 'OWNER' } } });
    expect(db.business.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
