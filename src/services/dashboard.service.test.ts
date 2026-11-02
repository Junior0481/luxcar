import { describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));

import { getDashboardData } from './dashboard.service';

const queryFor = (response: unknown) => {
  const query: any = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(response).then(resolve, reject),
  };
  return query;
};

describe('getDashboardData', () => {
  it('calculates metrics from the full tenant data and returns the five newest rows', async () => {
    const vehicles = [
      ...Array.from({ length: 5 }, (_, index) => ({ id: `vehicle-${index}`, status: 'disponivel', sale_price: 100, purchase_price: 60 })),
      { id: 'vehicle-sold', status: 'vendido', sale_price: 200, purchase_price: 100 },
    ];
    const negotiations = [
      { id: 'active', stage: 'avaliacao' },
      { id: 'finished', stage: 'finalizado' },
    ];
    fromMock.mockImplementation((table: string) => queryFor({
      data: table === 'vehicles' ? vehicles : negotiations,
      error: null,
    }));

    const result = await getDashboardData({ userId: 'user-1', companyId: 'company-1', role: 'administrador' });

    expect(result.metrics).toEqual({
      vehicles_available: 5,
      vehicles_in_negotiation: 0,
      vehicles_sold: 1,
      active_negotiations: 1,
      monthly_revenue: 0,
      potential_profit: 200,
    });
    expect(result.recentVehicles).toHaveLength(5);
    expect(result.recentNegotiations).toEqual(negotiations);
  });
});
