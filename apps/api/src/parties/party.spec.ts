import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CustomerDto } from '../customers/dto/customer.dto.js';
import { SupplierDto } from '../suppliers/dto/supplier.dto.js';
import { partyData, defined } from './party.data.js';
import { PartyQuery } from './party.dto.js';
const valid = {
  displayName: 'Test party',
  phone: '9876543210',
  addressLine1: '12 Market Road',
  city: 'Pune',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '411001',
};
describe('party validation and decimal representation', () => {
  it.each([CustomerDto, SupplierDto])(
    'accepts exact decimal strings with %s',
    (Dto) => {
      const dto = plainToInstance(Dto, {
        ...valid,
        openingBalance: '9999999999999.99',
      });
      expect(validateSync(dto)).toEqual([]);
      expect(partyData(dto, 'RECEIVABLE').openingBalance.toFixed(2)).toBe(
        '9999999999999.99',
      );
    },
  );
  it.each([-1, 1.25, '-1', '1.001', '1e3', '10000000000000', 'NaN', null])(
    'rejects invalid money %j',
    (value) => {
      expect(
        validateSync(plainToInstance(CustomerDto, { openingBalance: value }))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it.each([
    'displayName',
    'phone',
    'addressLine1',
    'city',
    'state',
    'stateCode',
    'pincode',
  ])('requires %s on creation', (key) => {
    expect(() =>
      partyData({ ...valid, [key]: undefined }, 'RECEIVABLE'),
    ).toThrow();
  });
  it('checks conditional GSTIN and PAN consistency', () => {
    expect(() =>
      partyData({ ...valid, gstRegistered: true }, 'PAYABLE'),
    ).toThrow();
    expect(() =>
      partyData(
        { ...valid, gstRegistered: true, gstin: '29ABCDE1234F1Z5' },
        'PAYABLE',
      ),
    ).toThrow();
    expect(() =>
      partyData(
        {
          ...valid,
          gstRegistered: true,
          gstin: '27ABCDE1234F1Z5',
          pan: 'ABCDE1234G',
        },
        'PAYABLE',
      ),
    ).toThrow();
    expect(() =>
      partyData({ ...valid, gstin: '27ABCDE1234F1Z5' }, 'PAYABLE'),
    ).toThrow();
  });
  it('preserves omitted PATCH values and supplied false/zero', () => {
    expect(
      defined(
        plainToInstance(CustomerDto, { isActive: false, paymentTermsDays: 0 }),
      ),
    ).toEqual({ isActive: false, paymentTermsDays: 0 });
  });
  it.each([
    { page: 0 },
    { pageSize: 101 },
    { page: 'oops' },
    { sortBy: 'accountNumber' },
    { sortOrder: 'sideways' },
    { gstRegistered: 'yes' },
  ])('rejects unsafe query %j', (query) => {
    expect(
      validateSync(plainToInstance(PartyQuery, query)).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { phone: null },
    { displayName: 4 },
    { pan: 'invalid' },
    { gstin: 'invalid' },
    { paymentTermsDays: 0.5 },
    { paymentTermsDays: -1 },
    { isActive: 'true' },
  ])('rejects malformed fields %j', (body) => {
    expect(
      validateSync(plainToInstance(CustomerDto, body)).length,
    ).toBeGreaterThan(0);
  });
});
