type Caller = { role: string; company_id: string | null };
type AccessLevel = 'platform_admin' | 'company_admin';
type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; status: 400 | 403; error: string };

const actionAccess = new Map<string, AccessLevel>([
  ['platform_overview', 'platform_admin'],
  ['set_company_status', 'platform_admin'],
  ['update_subscription', 'platform_admin'],
  ['confirm_renewal_payment', 'platform_admin'],
  ['mark_owner_access_delivered', 'platform_admin'],
  ['mark_onboarding_ready', 'platform_admin'],
  ['create_owner_recovery_link', 'platform_admin'],
  ['confirm_payment_and_provision', 'platform_admin'],
  ['create_member', 'company_admin'],
  ['mark_owner_first_login', 'company_admin'],
]);

export function authorizeAction(action: unknown, caller: Caller): AuthorizationResult {
  const accessLevel = typeof action === 'string' ? actionAccess.get(action) : undefined;
  if (!accessLevel) return { allowed: false, status: 400, error: 'Ação desconhecida.' };

  if (accessLevel === 'platform_admin' && caller.role !== 'platform_admin') {
    return { allowed: false, status: 403, error: 'Apenas o administrador da plataforma pode executar esta ação.' };
  }

  if (accessLevel === 'company_admin' && (caller.role !== 'administrador' || !caller.company_id)) {
    const error = action === 'create_member'
      ? 'Apenas administradores da empresa podem criar usuários.'
      : 'Ação disponível apenas para um administrador de concessionária.';
    return { allowed: false, status: 403, error };
  }

  return { allowed: true };
}
