import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

import { finalizeSale, setPaymentStatus } from './payments.service';

describe('payment RPC service', () => {
  beforeEach(() => rpcMock.mockReset().mockResolvedValue({ data: null, error: null }));

  it('preserves the set_payment_status RPC contract and result', async () => {
    const result = { data: null, error: null };

    const response = await setPaymentStatus('payment-1', 'paid');

    expect(rpcMock).toHaveBeenCalledWith('set_payment_status', {
      payment_id: 'payment-1',
      next_status: 'paid',
    });
    expect(response).toEqual(result);
  });

  it('preserves the finalize_sale RPC contract and result', async () => {
    const result = { data: null, error: null };

    const response = await finalizeSale('negotiation-1');

    expect(rpcMock).toHaveBeenCalledWith('finalize_sale', {
      target_negotiation: 'negotiation-1',
    });
    expect(response).toEqual(result);
  });
});
