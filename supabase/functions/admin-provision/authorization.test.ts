import { describe, expect, it } from 'vitest';
import { authorizeAction } from './authorization.ts';

const platformActions = [
  'platform_overview',
  'set_company_status',
  'update_subscription',
  'confirm_renewal_payment',
  'mark_owner_access_delivered',
  'mark_onboarding_ready',
  'create_owner_recovery_link',
  'confirm_payment_and_provision',
];

describe('admin-provision action authorization', () => {
  it.each(platformActions)('allows only platform admins to run %s', (action) => {
    expect(authorizeAction(action, { role: 'platform_admin', company_id: null })).toEqual({ allowed: true });
    expect(authorizeAction(action, { role: 'administrador', company_id: 'company-1' })).toEqual({
      allowed: false,
      status: 403,
      error: 'Apenas o administrador da plataforma pode executar esta ação.',
    });
  });

  it('allows tenant administrators to create company members only with a company', () => {
    expect(authorizeAction('create_member', { role: 'administrador', company_id: 'company-1' })).toEqual({ allowed: true });
    expect(authorizeAction('create_member', { role: 'administrador', company_id: null })).toEqual({
      allowed: false,
      status: 403,
      error: 'Apenas administradores da empresa podem criar usuários.',
    });
    expect(authorizeAction('create_member', { role: 'platform_admin', company_id: null })).toEqual({
      allowed: false,
      status: 403,
      error: 'Apenas administradores da empresa podem criar usuários.',
    });
  });

  it('allows first-login tracking only for tenant administrators with a company', () => {
    expect(authorizeAction('mark_owner_first_login', { role: 'administrador', company_id: 'company-1' })).toEqual({ allowed: true });
    expect(authorizeAction('mark_owner_first_login', { role: 'administrador', company_id: null })).toEqual({
      allowed: false,
      status: 403,
      error: 'Ação disponível apenas para um administrador de concessionária.',
    });
    expect(authorizeAction('mark_owner_first_login', { role: 'vendedor', company_id: 'company-1' })).toEqual({
      allowed: false,
      status: 403,
      error: 'Ação disponível apenas para um administrador de concessionária.',
    });
  });

  it('rejects unknown actions with the existing 400 response', () => {
    expect(authorizeAction('unknown_action', { role: 'vendedor', company_id: null })).toEqual({
      allowed: false,
      status: 400,
      error: 'Ação desconhecida.',
    });
  });
});
