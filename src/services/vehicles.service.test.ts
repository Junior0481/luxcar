import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));

import { updateVehicle, deleteVehicle } from './vehicles.service';

const tenant = { userId: 'user-1', companyId: 'company-1', role: 'administrador' as const };

describe('vehicle service writes', () => {
  beforeEach(() => fromMock.mockReset());

  it('rejects an invalid status before writing', async () => {
    const query: any = {
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };
    fromMock.mockReturnValue(query);

    await expect(updateVehicle(tenant, 'vehicle-1', { status: 'unknown' } as any))
      .rejects.toMatchObject({ kind: 'validation', userMessage: 'Status inválido.' });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('keeps a sold vehicle and checks sales within the caller tenant', async () => {
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'sale-1' }], error: null }),
    };
    fromMock.mockReturnValue(query);

    await expect(deleteVehicle(tenant, 'vehicle-1'))
      .rejects.toMatchObject({ userMessage: 'Não é possível excluir: este veículo já possui vendas registradas.' });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('sales');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'vehicle_id', 'vehicle-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'company_id', 'company-1');
  });
});
