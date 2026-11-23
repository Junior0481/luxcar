import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
const text = (value: unknown, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const acquisitionSources: string[] = ['instagram', 'google', 'referral', 'other'];
const planIds: string[] = ['silver', 'gold', 'platinum'];
const billingCycles: string[] = ['monthly', 'annual'];
// shortcut: blocks common disposable providers only; expand this list if temporary signups get through.
const disposableDomains = new Set([
  '10minutemail.com', 'dispostable.com', 'fakeinbox.com', 'getnada.com', 'guerrillamail.com',
  'maildrop.cc', 'mailinator.com', 'sharklasers.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com'
]);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Confirme seu email antes de enviar a solicitação.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user?.email_confirmed_at) return json({ error: 'Confirme seu email antes de enviar a solicitação.' }, 401);

    const body = await request.json();
    const values = {
      company_name: text(body.company_name),
      slug: text(body.slug, 80).toLowerCase(),
      owner_name: text(body.owner_name),
      owner_email: text(body.owner_email, 320).toLowerCase(),
      phone: text(body.phone, 40) || null,
      postal_code: text(body.postal_code, 8),
      address: text(body.address),
      address_number: text(body.address_number, 40),
      neighborhood: text(body.neighborhood),
      city: text(body.city, 120),
      state: text(body.state, 2).toUpperCase(),
      acquisition_source: text(body.acquisition_source, 20) || null,
      plan: text(body.plan, 20),
      billing_cycle: text(body.billing_cycle, 20)
    };
    if (!values.company_name || !values.slug || !values.owner_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.owner_email)
      || values.postal_code.length !== 8 || !values.address || !values.address_number || !values.neighborhood
      || !values.city || !/^[A-Z]{2}$/.test(values.state)
      || (values.acquisition_source !== null && !acquisitionSources.includes(values.acquisition_source))
      || !planIds.includes(values.plan)
      || !billingCycles.includes(values.billing_cycle)) {
      return json({ error: 'Confira os dados obrigatórios e tente novamente.' }, 400);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) return json({ error: 'O endereço curto da loja contém caracteres inválidos.' }, 400);
    if (user.email?.trim().toLowerCase() !== values.owner_email) return json({ error: 'O email confirmado não corresponde ao cadastro.' }, 403);
    const emailDomain = values.owner_email.split('@')[1];
    if ([...disposableDomains].some((domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`))) {
      return json({ error: 'Use um email que não seja temporário ou descartável.' }, 422);
    }

    const { data: profile, error: profileError } = await service.from('profiles')
      .select('role,company_id').eq('id', user.id).maybeSingle();
    if (profileError || !profile || profile.role !== 'vendedor' || profile.company_id) {
      return json({ error: 'Esta conta não pode ser usada para solicitar uma nova loja.' }, 409);
    }

    const cepResponse = await fetch(`https://viacep.com.br/ws/${values.postal_code}/json/`, { signal: AbortSignal.timeout(8000) });
    if (!cepResponse.ok) return json({ error: 'Não foi possível validar o CEP agora. Tente novamente.' }, 502);
    const cep = await cepResponse.json();
    if (cep.erro || cep.uf !== values.state || cep.localidade?.toLocaleLowerCase('pt-BR') !== values.city.toLocaleLowerCase('pt-BR')) {
      return json({ error: 'O CEP não corresponde à cidade e ao estado selecionados.' }, 422);
    }
    values.city = cep.localidade;
    values.state = cep.uf;

    const { data: plan, error: planError } = await service.from('plans')
      .select('id,monthly_price,annual_price').eq('id', values.plan).single();
    if (planError || !plan) return json({ error: 'Plano selecionado indisponível. Atualize a página e tente novamente.' }, 400);
    const amount = values.billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;
    const { error: insertError } = await service.from('subscription_requests').insert({
      ...values,
      quoted_amount: amount,
      payment_reference: null,
      status: 'pending_payment'
    });
    if (insertError) {
      if (insertError.code === '23505') {
        const { data: existingRequest } = await service.from('subscription_requests')
          .select('plan,quoted_amount').eq('slug', values.slug).eq('owner_email', values.owner_email)
          .eq('status', 'pending_payment').maybeSingle();
        if (existingRequest) return json({ success: true, plan: existingRequest.plan, amount: existingRequest.quoted_amount }, 201);
      }
      if (insertError.code === '23505') return json({ error: 'Já existe uma solicitação com este endereço curto. Escolha outro.' }, 409);
      return json({ error: 'Não foi possível registrar sua solicitação.' }, 500);
    }
    return json({ success: true, plan: plan.id, amount }, 201);
  } catch (error) {
    console.error('Subscription registration failed:', error);
    return json({ error: 'Não foi possível enviar sua solicitação agora. Tente novamente.' }, 500);
  }
});
