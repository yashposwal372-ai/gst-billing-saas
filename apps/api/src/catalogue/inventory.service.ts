import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '@gst/prisma-client/client';
import type { SafeUser } from '../users/user.select.js';
import { ownerScope, requireOwner } from '../parties/party.data.js';
import { movementView, productView, serializable } from './catalogue.data.js';
import type { AdjustmentDto, MovementQuery } from './catalogue.dto.js';
@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}
  // Called only by product creation inside its counter/product transaction.
  async opening(
    tx: Prisma.TransactionClient,
    user: SafeUser,
    id: string,
    quantity: Prisma.Decimal,
  ) {
    if (quantity.isZero()) return;
    const scope = ownerScope(user);
    const changed = await tx.product.updateMany({
      where: {
        ...scope,
        id,
        type: 'PRODUCT',
        trackInventory: true,
        currentStock: 0,
        openingStock: 0,
      },
      data: { openingStock: quantity, currentStock: quantity },
    });
    if (changed.count !== 1)
      throw new ConflictException('Opening stock could not be recorded');
    await tx.stockMovement.create({
      data: {
        businessId: scope.businessId,
        productId: id,
        type: 'OPENING',
        quantity,
        beforeStock: 0,
        afterStock: quantity,
        reason: 'Opening stock',
        createdById: user.id,
      },
    });
  }
  async adjust(user: SafeUser, id: string, dto: AdjustmentDto) {
    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.lte(0))
      throw new BadRequestException('Quantity must be greater than zero');
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const row = await tx.product.findFirst({ where: { ...scope, id } });
      if (!row) throw new NotFoundException('Product not found');
      if (!row.isActive || !row.trackInventory || row.type !== 'PRODUCT')
        throw new BadRequestException(
          'Only active inventory products can be adjusted',
        );
      const after =
        dto.direction === 'INCREASE'
          ? row.currentStock.plus(quantity)
          : row.currentStock.minus(quantity);
      if (after.lt(0))
        throw new BadRequestException(
          'Insufficient stock; negative stock is not allowed',
        );
      if (after.gt('999999999999999.999'))
        throw new BadRequestException('Stock exceeds supported quantity');
      const changed = await tx.product.updateMany({
        where: {
          ...scope,
          id,
          currentStock: row.currentStock,
          isActive: true,
          trackInventory: true,
          type: 'PRODUCT',
        },
        data: { currentStock: after },
      });
      if (changed.count !== 1)
        throw new ConflictException('Stock changed. Please retry.');
      const movement = await tx.stockMovement.create({
        data: {
          businessId: scope.businessId,
          productId: id,
          type:
            dto.direction === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity,
          beforeStock: row.currentStock,
          afterStock: after,
          reason: dto.reason,
          createdById: user.id,
        },
      });
      return {
        profile: productView({ ...row, currentStock: after }),
        movement: movementView(movement),
      };
    });
  }
  async history(user: SafeUser, id: string, query: MovementQuery) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        if (
          !(await tx.product.findFirst({
            where: { ...scope, id },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Product not found');
        const where = {
          ...scope,
          productId: id,
          ...(query.type ? { type: query.type } : {}),
        };
        const [rows, total] = await Promise.all([
          tx.stockMovement.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.stockMovement.count({ where }),
        ]);
        return {
          items: rows.map(movementView),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async summary(user: SafeUser) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        const active = { ...scope, type: 'PRODUCT' as const, isActive: true };
        const tracked = { ...active, trackInventory: true };
        const [
          totalActiveProducts,
          inventoryTrackedProducts,
          lowStockProducts,
          outOfStockProducts,
        ] = await Promise.all([
          tx.product.count({ where: active }),
          tx.product.count({ where: tracked }),
          tx.product.count({
            where: {
              ...tracked,
              currentStock: { gt: 0, lte: tx.product.fields.minimumStock },
            },
          }),
          tx.product.count({ where: { ...tracked, currentStock: { lte: 0 } } }),
        ]);
        return {
          totalActiveProducts,
          inventoryTrackedProducts,
          lowStockProducts,
          outOfStockProducts,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
