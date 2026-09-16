import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma, type Product } from '@gst/prisma-client/client';
import {
  CreateProductDto,
  ProductDto,
  ProductQuery,
  AdjustmentDto,
  CategoryDto,
} from './catalogue.dto.js';
import { productData, productView, serializable } from './catalogue.data.js';
describe('catalogue validation and exact decimal policy', () => {
  it.each(['0', '0.01', '9999999999999.99'])(
    'accepts exact money %s',
    (value) => {
      const dto = plainToInstance(CreateProductDto, {
        name: 'Product',
        salePrice: value,
      });
      expect(validateSync(dto)).toEqual([]);
      expect(productData(dto).salePrice.toFixed(2)).toBe(
        new Prisma.Decimal(value).toFixed(2),
      );
    },
  );
  it.each([-1, 1.1, '-1', '1e3', 'NaN', '1.001', '10000000000000', null])(
    'rejects money %j',
    (value) => {
      expect(
        validateSync(plainToInstance(CreateProductDto, { salePrice: value }))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it.each(['0', '0.001', '999999999999999.999'])(
    'accepts quantity %s',
    (openingStock) =>
      expect(
        validateSync(plainToInstance(CreateProductDto, { openingStock })),
      ).toEqual([]),
  );
  it.each([1, '-0.1', '1.0001', '1000000000000000', 'Infinity', '1e2', null])(
    'rejects quantity %j',
    (openingStock) =>
      expect(
        validateSync(plainToInstance(CreateProductDto, { openingStock }))
          .length,
      ).toBeGreaterThan(0),
  );
  it.each([
    { type: 'SERVICE', trackInventory: true },
    { type: 'SERVICE', openingStock: '1' },
    { minimumStock: '0' },
    { openingStock: '0.001' },
  ])('rejects incompatible stock %j', (v) =>
    expect(() =>
      productData({ name: 'Item', ...v } as CreateProductDto),
    ).toThrow(),
  );
  it('requires name on create', () =>
    expect(() => productData({})).toThrow('name'));
  it('maps empty unique identifiers to null', () =>
    expect(productData({ name: 'Test', sku: '', barcode: '' })).toMatchObject({
      sku: null,
      barcode: null,
    }));
  it.each([
    ['PRODUCT', '1234'],
    ['PRODUCT', '123456'],
    ['PRODUCT', '12345678'],
    ['SERVICE', '998311'],
  ])('accepts format-only %s %s', (type, hsnSacCode) =>
    expect(() =>
      productData({
        name: 'Item',
        type: type as 'PRODUCT' | 'SERVICE',
        hsnSacCode,
      }),
    ).not.toThrow(),
  );
  it.each([
    ['PRODUCT', '12345'],
    ['SERVICE', '123456'],
    ['SERVICE', '9983'],
  ])('rejects mismatched code %s %s', (type, hsnSacCode) =>
    expect(() =>
      productData({
        name: 'Item',
        type: type as 'PRODUCT' | 'SERVICE',
        hsnSacCode,
      }),
    ).toThrow(),
  );
  it.each(['-1', '100.01', '999', 18, null])('rejects GST %j', (gstRate) =>
    expect(
      validateSync(plainToInstance(ProductDto, { gstRate })).length,
    ).toBeGreaterThan(0),
  );
  it.each([
    { pageSize: 101 },
    { page: 0 },
    { sortBy: 'businessId' },
    { stockStatus: 'sold' },
    { type: 'OTHER' },
  ])('rejects query %j', (v) =>
    expect(
      validateSync(plainToInstance(ProductQuery, v)).length,
    ).toBeGreaterThan(0),
  );
  it('trims category names', () =>
    expect(plainToInstance(CategoryDto, { name: '  Food  ' }).name).toBe(
      'Food',
    ));
  it('rejects blank adjustment reason', () =>
    expect(
      validateSync(
        plainToInstance(AdjustmentDto, {
          direction: 'INCREASE',
          quantity: '1',
          reason: '   ',
        }),
      ).length,
    ).toBeGreaterThan(0));
  const row = {
    businessId: 'secret',
    type: 'PRODUCT',
    trackInventory: true,
    isActive: true,
    gstRate: new Prisma.Decimal(18),
    purchasePrice: new Prisma.Decimal('0.10'),
    salePrice: new Prisma.Decimal('0.30'),
    mrp: null,
    openingStock: new Prisma.Decimal('0.001'),
    currentStock: new Prisma.Decimal('0.301'),
    minimumStock: new Prisma.Decimal('0.301'),
  } as Product;
  it('preserves price/quantity scales and omits tenant data', () => {
    expect(productView(row)).toMatchObject({
      salePrice: '0.30',
      currentStock: '0.301',
      stockStatus: 'low',
    });
    expect(productView(row)).not.toHaveProperty('businessId');
  });
  it.each([
    [null, 'available'],
    ['0.300', 'available'],
    ['0.301', 'low'],
    ['1', 'low'],
  ])('classifies threshold %s', (min, status) =>
    expect(
      productView({
        ...row,
        minimumStock: min ? new Prisma.Decimal(min) : null,
      }).stockStatus,
    ).toBe(status),
  );
  it('distinguishes zero stock and services', () => {
    expect(
      productView({ ...row, currentStock: new Prisma.Decimal(0) }).stockStatus,
    ).toBe('out');
    expect(productView({ ...row, type: 'SERVICE' }).stockStatus).toBe(
      'not_tracked',
    );
  });
  it('retries serializable conflicts and stops at a bounded limit', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });
    const db = {
      $transaction: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('ok'),
    };
    expect(await serializable(db, async () => 'ok')).toBe('ok');
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    db.$transaction.mockReset().mockRejectedValue(error);
    await expect(serializable(db, async () => 'ok')).rejects.toThrow('retry');
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
});
