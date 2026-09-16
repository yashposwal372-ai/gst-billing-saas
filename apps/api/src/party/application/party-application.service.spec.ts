import { CustomerApplicationService } from './customer-application.service.js';
import { SupplierApplicationService } from './supplier-application.service.js';
import type { CustomerRepositoryPort, SupplierRepositoryPort } from './party-repository.port.js';
import type { PartyActor } from '../domain/party-types.js';

const user = { id: 'user-1', currentBusinessId: 'business-1' } as PartyActor;

describe('Party application boundary', () => {
  it('keeps customer lookup, update and deactivate scoped through the repository port', async () => {
    const calls: string[] = [];
    const repository: CustomerRepositoryPort = {
      create: vi.fn(),
      list: vi.fn(),
      detail: vi.fn(async (safeUser, id) => {
        calls.push(`detail:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
      update: vi.fn(async (safeUser, id) => {
        calls.push(`update:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
      deactivate: vi.fn(async (safeUser, id) => {
        calls.push(`deactivate:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
    };
    const service = new CustomerApplicationService(repository);

    await service.detail(user, 'customer-1');
    await service.update(user, 'customer-1', { displayName: 'Updated' });
    await service.deactivate(user, 'customer-1');

    expect(calls).toEqual([
      'detail:business-1:customer-1',
      'update:business-1:customer-1',
      'deactivate:business-1:customer-1',
    ]);
  });

  it('keeps supplier lookup, update and deactivate scoped through the repository port', async () => {
    const calls: string[] = [];
    const repository: SupplierRepositoryPort = {
      create: vi.fn(),
      list: vi.fn(),
      detail: vi.fn(async (safeUser, id) => {
        calls.push(`detail:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
      update: vi.fn(async (safeUser, id) => {
        calls.push(`update:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
      deactivate: vi.fn(async (safeUser, id) => {
        calls.push(`deactivate:${safeUser.currentBusinessId}:${id}`);
        return {} as never;
      }),
    };
    const service = new SupplierApplicationService(repository);

    await service.detail(user, 'supplier-1');
    await service.update(user, 'supplier-1', { displayName: 'Updated' });
    await service.deactivate(user, 'supplier-1');

    expect(calls).toEqual([
      'detail:business-1:supplier-1',
      'update:business-1:supplier-1',
      'deactivate:business-1:supplier-1',
    ]);
  });
});