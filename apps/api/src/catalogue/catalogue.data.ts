import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Prisma,
  type Product,
  type Category,
  type StockMovement,
} from '@gst/prisma-client/client';
import type { CreateProductDto } from './catalogue.dto.js';
import { required } from '../parties/party.data.js';
export function productData(dto: CreateProductDto) {
  const type = dto.type ?? 'PRODUCT';
  const trackInventory = dto.trackInventory ?? false;
  const openingStock = new Prisma.Decimal(dto.openingStock ?? '0');
  const minimumStock = dto.minimumStock
    ? new Prisma.Decimal(dto.minimumStock)
    : null;
  if (type === 'SERVICE' && trackInventory)
    throw new BadRequestException('Services cannot track inventory');
  if (!trackInventory && (!openingStock.isZero() || minimumStock !== null))
    throw new BadRequestException('Stock fields require inventory tracking');
  if (
    dto.hsnSacCode &&
    (type === 'SERVICE'
      ? !/^99\d{4}$/.test(dto.hsnSacCode)
      : !/^(\d{4}|\d{6}|\d{8})$/.test(dto.hsnSacCode))
  )
    throw new BadRequestException(
      'Use a 4, 6 or 8 digit HSN for products, or a 6 digit SAC starting with 99 for services',
    );
  return {
    name: required(dto.name, 'name'),
    type,
    unit: dto.unit ?? (type === 'SERVICE' ? 'SERVICE' : 'PCS'),
    description: dto.description || null,
    categoryId: dto.categoryId || null,
    sku: dto.sku || null,
    barcode: dto.barcode || null,
    hsnSacCode: dto.hsnSacCode || null,
    gstRate: new Prisma.Decimal(dto.gstRate ?? '0'),
    purchasePrice: new Prisma.Decimal(dto.purchasePrice ?? '0'),
    salePrice: new Prisma.Decimal(dto.salePrice ?? '0'),
    mrp: dto.mrp ? new Prisma.Decimal(dto.mrp) : null,
    trackInventory,
    minimumStock,
    isActive: dto.isActive ?? true,
  };
}
export function productView(
  row: Product & {
    category?: { id: string; name: string; isActive: boolean } | null;
  },
) {
  const { businessId: _businessId, ...profile } = row;
  return {
    ...profile,
    gstRate: row.gstRate.toFixed(2),
    purchasePrice: row.purchasePrice.toFixed(2),
    salePrice: row.salePrice.toFixed(2),
    mrp: row.mrp?.toFixed(2) ?? null,
    openingStock: row.openingStock.toFixed(3),
    currentStock: row.currentStock.toFixed(3),
    minimumStock: row.minimumStock?.toFixed(3) ?? null,
    stockStatus:
      !row.isActive || !row.trackInventory || row.type !== 'PRODUCT'
        ? 'not_tracked'
        : row.currentStock.lte(0)
          ? 'out'
          : row.minimumStock !== null && row.currentStock.lte(row.minimumStock)
            ? 'low'
            : 'available',
  };
}
export function categoryView(row: Category) {
  const { businessId: _businessId, nameKey: _nameKey, ...profile } = row;
  return profile;
}
export function movementView(row: StockMovement) {
  const { businessId: _businessId, ...movement } = row;
  return {
    ...movement,
    quantity: row.quantity.toFixed(3),
    beforeStock: row.beforeStock.toFixed(3),
    afterStock: row.afterStock.toFixed(3),
  };
}
export function catalogueError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    throw new ConflictException(
      'A category name, SKU, barcode or product code already exists in this business',
    );
  throw error;
}
export async function serializable<T>(
  db: {
    $transaction: (
      fn: (tx: Prisma.TransactionClient) => Promise<T>,
      options: { isolationLevel: 'Serializable' },
    ) => Promise<T>;
  },
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ))
        throw error;
      if (attempt === 2)
        throw new ConflictException('Concurrent change. Please retry.');
    }
  }
  throw new ConflictException('Please retry');
}
