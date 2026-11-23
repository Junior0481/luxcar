import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Creates an AbacatePay checkout for the plan and cycle of a signup request or a company renewal.
// Env: ABACATEPAY_API_KEY (dev key for sandbox), SITE_URL, optional ABACATEPAY_METHODS ("PIX" or "PIX,CARD").
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
const ABACATEPAY_URL = 'https://api.abacatepay.com/v2';
const REUSE_PENDING_MS = 24 * 60 * 60 * 1000;

type Plan = { id: string; name: string; monthly_price: number; annual_price: number };

async function abacatepay(path: string, apiKey: string, body: unknown) {
  const response = await fetch(`${ABACATEPAY_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(`AbacatePay ${path} falhou (${response.status}): ${payload?.error ?? 'resposta inválida'}`);
  }
  return payload.data;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const apiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!apiKey) return json({ error: 'Pagamento online ainda não configurado. Fale com a equipe LuxCar.' }, 503);
    const siteUrl = (Deno.env.get('SITE_URL') || 'https://luxcar-six.vercel.app').replace(/\/$/, '');
    const methods = (Deno.env.get('ABACATEPAY_METHODS') || 'PIX').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);

    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Não autenticado.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } });
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'Sessão inválida.' }, 401);
    const { data: profile } = await service.from('profiles').select('id, role, company_id').eq('id', user.id).maybeSingle();
    if (!profile) return json({ error: 'Perfil não encontrado.' }, 403);

    const body = await request.json().catch(() => ({}));
    const kind = body.kind === 'signup' ? 'signup' : 'renewal';
    let target: { requestId: string | null; companyId: string | null; planId: string; cycle: 'monthly' | 'annual'; label: string };

    if (kind === 'signup') {
      if (!user.email_confirmed_at || !user.email) return json({ error: 'Confirme seu email antes de pagar.' }, 401);
      const { data: subscriptionRequest } = await service.from('subscription_requests')
        .select('id, plan, billing_cycle, company_name').eq('owner_email', user.email.toLowerCase())
        .eq('status', 'pending_payment').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!subscriptionRequest?.plan) return json({ error: 'Nenhuma solicitação aguardando pagamento para este email.' }, 404);
      target = {
        requestId: subscriptionRequest.id, companyId: null, planId: subscriptionRequest.plan,
        cycle: subscriptionRequest.billing_cycle === 'annual' ? 'annual' : 'monthly', label: subscriptionRequest.company_name
      };
    } else {
      const companyId = profile.role === 'platform_admin' ? body.companyId : profile.company_id;
      if (!companyId || (profile.role !== 'platform_admin' && profile.role !== 'administrador')) {
        return json({ error: 'Apenas o administrador da loja ou da plataforma gera a cobrança.' }, 403);
      }
      const { data: company } = await service.from('companies').select('id, name, plan, billing_cycle, subscription_status').eq('id', companyId).maybeSingle();
      if (!company) return json({ error: 'Concessionária não encontrada.' }, 404);
      if (company.subscription_status === 'cancelled') return json({ error: 'Assinatura cancelada não pode ser renovada por aqui.' }, 409);
      target = {
        requestId: null, companyId: company.id, planId: company.plan,
        cycle: company.billing_cycle === 'annual' ? 'annual' : 'monthly', label: company.name
      };
    }

    const { data: plan } = await service.from('plans').select('id, name, monthly_price, annual_price').eq('id', target.planId).single<Plan>();
    if (!plan) return json({ error: 'Plano não encontrado.' }, 400);
    const amount = Number(target.cycle === 'annual' ? plan.annual_price : plan.monthly_price);
    const cents = Math.round(amount * 100);

    // Reuse a recent pending checkout for the same target and amount instead of creating duplicates.
    let pendingQuery = service.from('payment_charges').select('checkout_url, amount, created_at')
      .eq('kind', kind).eq('status', 'pending').eq('amount', amount)
      .gte('created_at', new Date(Date.now() - REUSE_PENDING_MS).toISOString())
      .order('created_at', { ascending: false }).limit(1);
    pendingQuery = target.requestId ? pendingQuery.eq('subscription_request_id', target.requestId) : pendingQuery.eq('company_id', target.companyId);
    const { data: pending } = await pendingQuery.maybeSingle();
    if (pending) return json({ url: pending.checkout_url, amount, plan: plan.name, cycle: target.cycle, reused: true });

    const productExternalId = `luxcar-${plan.id}-${target.cycle}-${cents}`;
    const { data: storedProduct } = await service.from('abacatepay_products').select('product_id').eq('external_id', productExternalId).maybeSingle();
    let productId = storedProduct?.product_id as string | undefined;
    if (!productId) {
      const product = await abacatepay('/products/create', apiKey, {
        externalId: productExternalId,
        name: `LuxCar ${plan.name} · ${target.cycle === 'annual' ? 'anual' : 'mensal'}`,
        price: cents,
        currency: 'BRL'
      });
      productId = product.id as string;
      await service.from('abacatepay_products').upsert({ external_id: productExternalId, product_id: productId });
    }

    const reference = target.requestId ? `request:${target.requestId}` : `company:${target.companyId}`;
    const checkout = await abacatepay('/checkouts/create', apiKey, {
      items: [{ id: productId, quantity: 1 }],
      methods,
      externalId: `${reference}:${Date.now()}`,
      returnUrl: kind === 'signup' ? `${siteUrl}/auth/register` : `${siteUrl}/dashboard/settings`,
      completionUrl: kind === 'signup' ? `${siteUrl}/auth/login?pagamento=confirmado` : `${siteUrl}/dashboard/settings?pagamento=confirmado`,
      metadata: { kind, reference, plan: plan.id, cycle: target.cycle }
    });

    const { error: insertError } = await service.from('payment_charges').insert({
      provider_charge_id: checkout.id, kind,
      subscription_request_id: target.requestId, company_id: target.companyId,
      plan: plan.id, billing_cycle: target.cycle, amount, checkout_url: checkout.url, created_by: profile.id
    });
    if (insertError) return json({ error: `Cobrança criada, mas não foi registrada: ${insertError.message}` }, 500);

    return json({ url: checkout.url, amount, plan: plan.name, cycle: target.cycle, reused: false }, 201);
  } catch (error) {
    console.error('create-charge failed:', error);
    return json({ error: 'Não foi possível gerar a cobrança agora. Tente novamente.' }, 502);
  }
});
