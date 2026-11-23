import { supabase } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';

export type SubscriptionStatus = 'active' | 'past_due' | 'blocked' | 'cancelled';

export type CompanySubscription = {
  company_id: string;
  plan: string;
  billing_cycle: 'monthly' | 'annual';
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  grace_ends_at: string | null;
};

export type SubscriptionNotice =
  | { kind: 'due_today' }
  | { kind: 'grace'; daysLeft: number }
  | { kind: 'blocked' }
  | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Assinatura da empresa do usuário logado; lida mesmo quando a empresa está bloqueada. */
export async function getCompanySubscription(): Promise<CompanySubscription | null> {
  const { data, error } = await supabase.rpc('current_company_subscription');
  if (error) throw normalizeSupabaseError(error);
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

/** Aviso a mostrar no painel: dia do vencimento, dias restantes da tolerância ou bloqueio. */
export function subscriptionNotice(subscription: CompanySubscription | null, now = new Date()): SubscriptionNotice {
  if (!subscription || subscription.subscription_status === 'cancelled') return null;
  if (subscription.subscription_status === 'blocked') return { kind: 'blocked' };
  if (subscription.subscription_status === 'past_due' && subscription.grace_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((Date.parse(subscription.grace_ends_at) - now.getTime()) / DAY_MS));
    return { kind: 'grace', daysLeft };
  }
  if (subscription.current_period_end) {
    const due = new Date(subscription.current_period_end);
    const sameDay = due.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      === now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (sameDay) return { kind: 'due_today' };
  }
  return null;
}
