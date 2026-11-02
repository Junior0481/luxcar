import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

import { convertLeadToNegotiation } from './negotiations.service';

describe('convertLeadToNegotiation', () => {
  beforeEach(() => rpcMock.mockReset());

  it('calls the conversion RPC with the lead form values and returns its negotiation id', async () => {
    rpcMock.mockResolvedValue({ data: 'negotiation-1', error: null });

    await expect(convertLeadToNegotiation({
      leadId: 'lead-1',
      vehicleId: 'vehicle-1',
      clientCpf: '12345678901',
      stage: 'avaliacao',
      offeredPrice: 100000,
      notes: 'Cliente quer financiar',
      priority: 'alta',
    })).resolves.toBe('negotiation-1');

    expect(rpcMock).toHaveBeenCalledWith('convert_lead_to_negotiation', {
      p_lead_id: 'lead-1',
      p_vehicle_id: 'vehicle-1',
      p_client_cpf: '12345678901',
      p_stage: 'avaliacao',
      p_offered_price: 100000,
      p_notes: 'Cliente quer financiar',
      p_priority: 'alta',
    });
  });
});
