import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';
import {
  defined,
  ownerScope,
  requireOwner,
  required,
} from '../parties/party.data.js';
import {
  catalogueError,
  categoryView,
  serializable,
} from './catalogue.data.js';
import type { CategoryDto, CategoryQuery } from './catalogue.dto.js';
@Injectable()
export class CategoriesService {
  constructor(private readonly db: DatabaseService) {}
  async create(user: SafeUser, dto: CategoryDto) {
    const name = required(dto.name, 'name');
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user);
        return categoryView(
          await tx.category.create({
            data: {
              businessId: scope.businessId,
              name,
              nameKey: name.toLowerCase(),
              description: dto.description || null,
              isActive: dto.isActive ?? true,
            },
          }),
        );
      });
    } catch (e) {
      catalogueError(e);
    }
  }
  async list(user: SafeUser, query: CategoryQuery) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        const where = {
          ...scope,
          ...(query.status === 'all'
            ? {}
            : { isActive: query.status === 'active' }),
          ...(query.search
            ? { name: { contains: query.search, mode: 'insensitive' as const } }
            : {}),
        };
        const [rows, total] = await Promise.all([
          tx.category.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.category.count({ where }),
        ]);
        return {
          items: rows.map(categoryView),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async detail(user: SafeUser, id: string) {
    const row = await this.db.category.findFirst({
      where: { ...ownerScope(user), id },
    });
    if (!row) throw new NotFoundException('Category not found');
    return categoryView(row);
  }
  async update(user: SafeUser, id: string, dto: CategoryDto) {
    try {
      return await serializable(this.db, async (tx) => {
        const scope = await requireOwner(tx, user);
        const row = await tx.category.findFirst({ where: { ...scope, id } });
        if (!row) throw new NotFoundException('Category not found');
        const values = { ...row, ...defined(dto) };
        const name = required(values.name, 'name');
        await tx.category.updateMany({
          where: { ...scope, id },
          data: {
            name,
            nameKey: name.toLowerCase(),
            description: values.description || null,
            isActive: values.isActive,
          },
        });
        return categoryView(
          await tx.category.findFirstOrThrow({ where: { ...scope, id } }),
        );
      });
    } catch (e) {
      catalogueError(e);
    }
  }
}
