import { describe, expect, it } from 'vitest';
import { subscriptionNotice, type CompanySubscription } from './subscription.service';

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
