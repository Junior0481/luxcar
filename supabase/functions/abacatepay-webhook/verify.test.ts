import { describe, expect, it } from 'vitest';
import { hmacBase64, verifyWebhook } from './verify.ts';

const body = '{"event":"checkout.completed"}';

describe('verifyWebhook', () => {
  it('accepts the configured secret and a valid signature', async () => {
    const signature = await hmacBase64('public-key', body);
    await expect(verifyWebhook({ expectedSecret: 's3cret', receivedSecret: 's3cret', publicKey: 'public-key', signature, rawBody: body }))
      .resolves.toEqual({ ok: true });
  });

  it('rejects a wrong secret', async () => {
    await expect(verifyWebhook({ expectedSecret: 's3cret', receivedSecret: 'nope', publicKey: undefined, signature: null, rawBody: body }))
      .resolves.toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a body changed after signing', async () => {
    const signature = await hmacBase64('public-key', body);
    await expect(verifyWebhook({ expectedSecret: 's3cret', receivedSecret: 's3cret', publicKey: 'public-key', signature, rawBody: `${body} ` }))
      .resolves.toMatchObject({ ok: false, status: 401, error: 'Invalid signature' });
  });

  it('fails closed when the secret is not configured', async () => {
    await expect(verifyWebhook({ expectedSecret: undefined, receivedSecret: 'x', publicKey: undefined, signature: null, rawBody: body }))
      .resolves.toMatchObject({ ok: false, status: 500 });
  });
});
