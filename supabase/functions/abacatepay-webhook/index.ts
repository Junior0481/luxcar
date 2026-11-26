import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyWebhook } from './verify.ts';

// Receives AbacatePay webhooks. Deploy with --no-verify-jwt (AbacatePay sends no Supabase JWT).
// Env: ABACATEPAY_WEBHOOK_SECRET (the secret set when creating the webhook),
// ABACATEPAY_PUBLIC_KEY (AbacatePay's public HMAC key, required to check the body signature) and
// ABACATEPAY_ACCEPT_DEV_EVENTS=true only while the account runs in test mode (simulated payments).
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await request.text();
  const verification = await verifyWebhook({
    expectedSecret: Deno.env.get('ABACATEPAY_WEBHOOK_SECRET'),
    receivedSecret: request.headers.get('X-Webhook-Secret') ?? new URL(request.url).searchParams.get('webhookSecret'),
    publicKey: Deno.env.get('ABACATEPAY_PUBLIC_KEY'),
    signature: request.headers.get('X-Webhook-Signature'),
    rawBody
  });
  if (!verification.ok) return json({ error: verification.error }, verification.status);

  let event: { event?: string; devMode?: boolean; data?: { checkout?: { id?: string; status?: string; paidAmount?: number | null; devMode?: boolean } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const checkout = event.data?.checkout;
  if (event.event !== 'checkout.completed' || checkout?.status !== 'PAID' || !checkout.id) {
    return json({ received: true, ignored: event.event ?? 'unknown' });
  }

  // Test-mode events are simulated payments: never provision or renew from them in production.
  if ((event.devMode === true || checkout.devMode === true)
    && Deno.env.get('ABACATEPAY_ACCEPT_DEV_EVENTS') !== 'true') {
    console.warn('Ignored test-mode webhook:', checkout.id);
    return json({ received: true, ignored: 'dev_mode' });
  }
  if (typeof checkout.paidAmount !== 'number') {
    console.error('Webhook without paidAmount:', checkout.id);
    return json({ error: 'Missing paidAmount' }, 422);
  }

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const paidAmount = checkout.paidAmount / 100;
  const { data, error } = await service.rpc('apply_paid_charge', { p_provider_charge_id: checkout.id, p_paid_amount: paidAmount });
  if (error) {
    // 500 makes AbacatePay retry; apply_paid_charge is idempotent.
    console.error('apply_paid_charge failed:', checkout.id, error.message);
    return json({ error: 'Processing failed' }, 500);
  }
  if (data?.status === 'unknown_charge') console.warn('Webhook for unknown charge:', checkout.id);
  return json({ received: true, result: data?.status });
});
