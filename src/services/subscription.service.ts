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
  /** Status operacional da empresa (a plataforma pode suspender). */
  company_status?: string;
};

export type SubscriptionNotice =
  | { kind: 'due_today' }
  | { kind: 'grace'; daysLeft: number }
  | { kind: 'blocked' }
  | { kind: 'suspended' }
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
  if (!subscription) return null;
  if (subscription.company_status && subscription.company_status !== 'active') return { kind: 'suspended' };
  if (subscription.subscription_status === 'cancelled') return null;
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

export type SubscriptionPayment = {
  id: string;
  payment_reference: string | null;
  amount: number | null;
  period_start: string;
  period_end: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
};

export type Charge = { url: string; amount: number; plan: string; cycle: 'monthly' | 'annual'; reused: boolean };

/** Histórico de pagamentos da assinatura (administrador da loja ou da plataforma). */
export async function listSubscriptionPayments(companyId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('id, payment_reference, amount, period_start, period_end, status, confirmed_at, created_at')
    .eq('company_id', companyId)
    .order('period_start', { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data as SubscriptionPayment[]) ?? [];
}

/** Gera (ou reaproveita) a cobrança AbacatePay da próxima renovação. */
export async function createRenewalCharge(companyId?: string): Promise<Charge> {
  const { data, error } = await supabase.functions.invoke('create-charge', { body: { kind: 'renewal', companyId } });
  if (error || !data?.url) {
    let message = data?.error as string | undefined;
    const response = (error as { context?: Response } | null)?.context;
    if (!message && response) message = (await response.clone().json().catch(() => null))?.error;
    throw new Error(message || 'Não foi possível gerar a cobrança agora.');
  }
  return data as Charge;
}

const RECENT_PAYMENT_MS = 15 * 60 * 1000;
const BASELINE_KEY = 'luxcar:checkout-baseline';

/** Guarda o vencimento antes de ir ao checkout, para reconhecer a renovação na volta. */
export function rememberCheckoutBaseline(subscription: CompanySubscription | null): void {
  if (!subscription) return;
  try {
    sessionStorage.setItem(BASELINE_KEY, JSON.stringify({ companyId: subscription.company_id, periodEnd: subscription.current_period_end }));
  } catch { /* storage indisponível: cai no critério do histórico */ }
}

export function readCheckoutBaseline(companyId: string): { periodEnd: string | null } | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(BASELINE_KEY) || 'null');
    return stored && stored.companyId === companyId ? { periodEnd: stored.periodEnd ?? null } : null;
  } catch {
    return null;
  }
}

export function clearCheckoutBaseline(): void {
  try { sessionStorage.removeItem(BASELINE_KEY); } catch { /* nada a limpar */ }
}

/**
 * Verdadeiro quando a renovação paga já foi aplicada pelo webhook: o vencimento avançou além do que
 * era antes do checkout. Sem essa referência, exige um pagamento automático confirmado há pouco
 * que tenha gerado o vencimento atual.
 */
export function isRenewalConfirmed(
  subscription: CompanySubscription | null,
  payments: SubscriptionPayment[],
  baseline: { periodEnd: string | null } | null,
  now = new Date()
): boolean {
  if (!subscription?.current_period_end) return false;
  const currentEnd = Date.parse(subscription.current_period_end);
  if (baseline) return baseline.periodEnd === null || currentEnd > Date.parse(baseline.periodEnd);
  return payments.some((payment) => {
    if (payment.status !== 'confirmed' || !payment.payment_reference?.startsWith('abacatepay:')) return false;
    if (Date.parse(payment.period_end) !== currentEnd) return false;
    const confirmed = Date.parse(payment.confirmed_at || payment.created_at);
    return Number.isFinite(confirmed) && now.getTime() - confirmed >= -60_000 && now.getTime() - confirmed <= RECENT_PAYMENT_MS;
  });
}

const SUBSCRIPTION_CHANGED = 'luxcar:subscription-changed';

/** Avisa o layout (faixa de atraso, tela de bloqueio) que a assinatura mudou. */
export function notifySubscriptionChanged(): void {
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED));
}

export function onSubscriptionChanged(listener: () => void): () => void {
  window.addEventListener(SUBSCRIPTION_CHANGED, listener);
  return () => window.removeEventListener(SUBSCRIPTION_CHANGED, listener);
}
