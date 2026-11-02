import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  SUPABASE_URL: 'https://demo.supabase.co',
  supabase: { functions: { invoke: invokeMock } },
}));

import { createLead } from './leads.service';

describe('createLead', () => {
  beforeEach(() => {
    invokeMock.mockReset().mockResolvedValue({ data: { id: 'lead-123' }, error: null });
  });

  it('uses the public-lead function and returns its created id', async () => {
    const result = await createLead({
      company_id: 'company-456',
      vehicle_id: 'vehicle-123',
      customer_name: ' Ana Silva ',
      customer_email: 'ana@example.com',
      customer_phone: '',
      message: 'Tenho interesse',
      turnstile_token: 'valid-token',
    });

    expect(invokeMock).toHaveBeenCalledWith('public-lead', {
      body: {
        company_id: 'company-456',
        vehicle_id: 'vehicle-123',
        customer_name: 'Ana Silva',
        customer_email: 'ana@example.com',
        customer_phone: null,
        message: 'Tenho interesse',
        source: 'website',
        status: 'new',
        turnstile_token: 'valid-token',
      },
    });
    expect(result).toEqual({ id: 'lead-123' });
  });
});
