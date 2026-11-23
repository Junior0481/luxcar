import { describe, expect, it } from 'vitest';
import { hasRecentPayment, subscriptionNotice, type CompanySubscription, type SubscriptionPayment } from './subscription.service';

const base: CompanySubscription = {
  company_id: 'company-1', plan: 'silver', billing_cycle: 'monthly', subscription_status: 'active',
  current_period_end: '2026-11-23T15:00:00.000Z', grace_ends_at: '2026-11-30T15:00:00.000Z'
};

describe('subscriptionNotice', () => {
  it('reminds on the due day', () => {
    expect(subscriptionNotice(base, new Date('2026-11-23T12:00:00.000Z'))).toEqual({ kind: 'due_today' });
  });

  it('stays quiet before the due day', () => {
    expect(subscriptionNotice(base, new Date('2026-11-20T12:00:00.000Z'))).toBeNull();
  });

  it('counts the grace days left', () => {
    expect(subscriptionNotice({ ...base, subscription_status: 'past_due' }, new Date('2026-11-24T15:00:00.000Z')))
      .toEqual({ kind: 'grace', daysLeft: 6 });
  });

  it('reports blocked companies', () => {
    expect(subscriptionNotice({ ...base, subscription_status: 'blocked' })).toEqual({ kind: 'blocked' });
  });
});

describe('hasRecentPayment', () => {
  const payment = (confirmedAt: string | null, createdAt = '2026-01-01T00:00:00.000Z'): SubscriptionPayment => ({
    id: 'p', payment_reference: null, amount: 400, period_start: '2026-11-23T15:00:00.000Z',
    period_end: '2026-12-23T15:00:00.000Z', status: 'confirmed', confirmed_at: confirmedAt, created_at: createdAt
  });
  const now = new Date('2026-11-23T15:10:00.000Z');

  it('detects a payment confirmed in the last minutes', () => {
    expect(hasRecentPayment([payment('2026-11-23T15:05:00.000Z')], now)).toBe(true);
  });

  it('ignores older payments', () => {
    expect(hasRecentPayment([payment('2026-11-23T14:00:00.000Z')], now)).toBe(false);
    expect(hasRecentPayment([], now)).toBe(false);
  });

  it('falls back to created_at when confirmed_at is missing', () => {
    expect(hasRecentPayment([payment(null, '2026-11-23T15:09:00.000Z')], now)).toBe(true);
  });
});
