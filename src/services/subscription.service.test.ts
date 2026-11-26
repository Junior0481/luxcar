import { describe, expect, it } from 'vitest';
import { isRenewalConfirmed, subscriptionNotice, type CompanySubscription, type SubscriptionPayment } from './subscription.service';

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

describe('isRenewalConfirmed', () => {
  const renewed: CompanySubscription = { ...base, current_period_end: '2026-12-23T15:00:00.000Z' };
  const payment = (overrides: Partial<SubscriptionPayment> = {}): SubscriptionPayment => ({
    id: 'p', payment_reference: 'abacatepay:bill_1', amount: 400, period_start: '2026-11-23T15:00:00.000Z',
    period_end: '2026-12-23T15:00:00.000Z', status: 'confirmed', confirmed_at: '2026-11-23T15:05:00.000Z',
    created_at: '2026-11-23T15:05:00.000Z', ...overrides
  });
  const now = new Date('2026-11-23T15:10:00.000Z');

  it('confirms when the due date moved past the one seen before the checkout', () => {
    expect(isRenewalConfirmed(renewed, [], { periodEnd: base.current_period_end }, now)).toBe(true);
    expect(isRenewalConfirmed(base, [payment()], { periodEnd: base.current_period_end }, now)).toBe(false);
  });

  it('without a baseline, needs a recent automatic payment that produced the current due date', () => {
    expect(isRenewalConfirmed(renewed, [payment()], null, now)).toBe(true);
    expect(isRenewalConfirmed(renewed, [payment({ payment_reference: 'manual-1' })], null, now)).toBe(false);
    expect(isRenewalConfirmed(renewed, [payment({ status: 'pending' })], null, now)).toBe(false);
    expect(isRenewalConfirmed(base, [payment()], null, now)).toBe(false);
    expect(isRenewalConfirmed(renewed, [payment({ confirmed_at: '2026-11-23T14:00:00.000Z' })], null, now)).toBe(false);
  });
});

describe('subscriptionNotice suspension', () => {
  it('reports a company suspended by the platform', () => {
    expect(subscriptionNotice({ ...base, company_status: 'suspended' })).toEqual({ kind: 'suspended' });
  });
});
