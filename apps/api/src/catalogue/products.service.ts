import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '@gst/prisma-client/client';
import type { SafeUser } from '../users/user.select.js';
import { defined, ownerScope, requireOwner } from '../parties/party.data.js';
import {
  catalogueError,
  productData,
  productView,
  serializable,
} from './catalogue.data.js';
import type {
  CreateProductDto,
  ProductDto,
  ProductQuery,
} from './catalogue.dto.js';
import { InventoryService } from './inventory.service.js';
const include = {
  category: { select: { id: true, name: true, isActive: true } },
} as const;
@Injectable()
export class ProductsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly inventory: InventoryService,
  ) {}
  private async category(
    tx: Prisma.TransactionClient,
    user: SafeUser,
    id: string | null,
    existing?: string | null,
  ) {
    if (!id) return;
    const category = await tx.category.findFirst({
      where: { ...ownerScope(user), id },
      select: { isActive: true },
    });
    if (!category || (!category.isActive && id !== existing))
      throw new BadRequestException(
        'Choose an active category from this business',
      );
  }
  async create(user: SafeUser, dto: CreateProductDto) {
    const data = productData(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user);
        await this.category(tx, user, data.categoryId);
        const sequence = await tx.business.update({
          where: { id: scope.businessId },
          data: { nextProductNumber: { increment: 1 } },
          select: { nextProductNumber: true },
        });
        const row = await tx.product.create({
          data: {
            ...data,
            businessId: scope.businessId,
            productCode:
              'PRD-' + String(sequence.nextProductNumber).padStart(6, '0'),
          },
        });
        await this.inventory.opening(
          tx,
          user,
          row.id,
          new Prisma.Decimal(dto.openingStock ?? '0'),
        );
        return productView(
          await tx.product.findFirstOrThrow({
            where: { ...scope, id: row.id },
            include,
          }),
        );
      });
    } catch (e) {
      catalogueError(e);
    }
  }
  async list(user: SafeUser, q: ProductQuery) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        const where: Prisma.ProductWhereInput = {
          ...scope,
          ...(q.status === 'all' ? {} : { isActive: q.status === 'active' }),
          ...(q.type ? { type: q.type } : {}),
          ...(q.categoryId ? { categoryId: q.categoryId } : {}),
          ...(q.gstRate ? { gstRate: new Prisma.Decimal(q.gstRate) } : {}),
          ...(q.search
            ? {
                OR: ['name', 'productCode', 'sku', 'barcode', 'hsnSacCode'].map(
                  (k) => ({ [k]: { contains: q.search, mode: 'insensitive' } }),
                ),
              }
            : {}),
          ...(q.stockStatus === 'all'
            ? {}
            : {
                AND: [
                  { type: 'PRODUCT', trackInventory: true, isActive: true },
                  ...(q.stockStatus === 'low'
                    ? [
                        {
                          currentStock: {
                            gt: 0,
                            lte: tx.product.fields.minimumStock,
                          },
                        },
                      ]
                    : q.stockStatus === 'out'
                      ? [{ currentStock: { lte: 0 } }]
                      : []),
                ],
              }),
        };
        const [rows, total] = await Promise.all([
          tx.product.findMany({
            where,
            include,
            orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
            skip: (q.page - 1) * q.pageSize,
            take: q.pageSize,
          }),
          tx.product.count({ where }),
        ]);
        return {
          items: rows.map(productView),
          total,
          page: q.page,
          pageSize: q.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async detail(user: SafeUser, id: string) {
    const row = await this.db.product.findFirst({
      where: { ...ownerScope(user), id },
      include,
    });
    if (!row) throw new NotFoundException('Product not found');
    return productView(row);
  }
  async barcode(user: SafeUser, barcode: string) {
    if (!barcode || barcode.length > 100)
      throw new BadRequestException('Invalid barcode');
    const row = await this.db.product.findFirst({
      where: { ...ownerScope(user), barcode },
      include,
    });
    if (!row) throw new NotFoundException('Product not found');
    return productView(row);
  }
  async update(user: SafeUser, id: string, dto: ProductDto) {
    try {
      return await serializable(this.db, async (tx) => {
        const scope = await requireOwner(tx, user);
        const row = await tx.product.findFirst({ where: { ...scope, id } });
        if (!row) throw new NotFoundException('Product not found');
        for (const key of ['type', 'unit', 'trackInventory'] as const)
          if (dto[key] !== undefined && dto[key] !== row[key])
            throw new BadRequestException(
              key + ' cannot change after creation; create a separate item',
            );
        const old = productView(row);
        const data = productData({
          ...old,
          ...defined(dto),
          openingStock: '0',
          categoryId: old.categoryId ?? '',
          description: old.description ?? '',
          sku: old.sku ?? '',
          barcode: old.barcode ?? '',
          hsnSacCode: old.hsnSacCode ?? '',
          mrp: old.mrp ?? '',
          minimumStock: old.minimumStock ?? '',
          ...defined(dto),
        });
        await this.category(tx, user, data.categoryId, row.categoryId);
        await tx.product.updateMany({ where: { ...scope, id }, data });
        return productView(
          await tx.product.findFirstOrThrow({
            where: { ...scope, id },
            include,
          }),
        );
      });
    } catch (e) {
      catalogueError(e);
    }
  }
}
