import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createLeadMock } = vi.hoisted(() => ({ createLeadMock: vi.fn() }));
let turnstileCallback: ((token: string) => void) | undefined;

vi.mock('../../services/leads.service', () => ({ createLead: createLeadMock }));

import { LeadForm } from './LeadForm';

describe('LeadForm', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    createLeadMock.mockReset().mockResolvedValue({ id: 'lead-123' });
    turnstileCallback = undefined;
    delete window.turnstile;
  });

  afterEach(() => {
    delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
  });

  it('shows success after the service returns the created lead id', async () => {
    const user = userEvent.setup();
    render(
      <LeadForm
        vehicleId="vehicle-123"
        companyId="company-456"
        vehicleName="Carro de teste"
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText('Verificação antispam indisponível.')).toBeNull();
    const script = await waitFor(() => {
      const loadedScript = document.querySelector<HTMLScriptElement>('script[data-cloudflare-turnstile]');
      expect(loadedScript).not.toBeNull();
      return loadedScript!;
    });

    await act(async () => {
      window.turnstile = {
        render: (_container, options) => {
          turnstileCallback = options.callback;
          return 'widget-1';
        },
        remove: vi.fn(),
        reset: vi.fn(),
      };
      script.dispatchEvent(new Event('load'));
    });
    await waitFor(() => expect(turnstileCallback).toBeTypeOf('function'));
    await act(async () => turnstileCallback?.('valid-token'));

    await user.type(screen.getByLabelText('Seu Nome *'), 'Ana Silva');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }).closest('form')!);

    expect(await screen.findByRole('status')).toHaveTextContent('Mensagem enviada com sucesso!');
    expect(createLeadMock).toHaveBeenCalledWith({
      company_id: 'company-456',
      vehicle_id: 'vehicle-123',
      customer_name: 'Ana Silva',
      customer_email: 'ana@example.com',
      customer_phone: '',
      message: '',
      turnstile_token: 'valid-token',
    });
  });
});
