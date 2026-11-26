import { describe, expect, it } from 'vitest';
import { rateLimitMessage } from './ForgotPassword';

describe('rateLimitMessage', () => {
  it('asks for the short per-address wait Supabase reports', () => {
    expect(rateLimitMessage({ status: 429, message: 'For security purposes, you can only request this after 42 seconds.' }))
      .toContain('aguarde 1 minuto');
  });

  it('does not promise one minute for the hourly email limit', () => {
    const message = rateLimitMessage({ status: 429, message: 'email rate limit exceeded' });
    expect(message).toContain('mais tarde');
    expect(message).not.toContain('1 minuto');
  });

  it('ignores other errors', () => {
    expect(rateLimitMessage({ status: 400, message: 'Invalid email' })).toBeNull();
  });
});
