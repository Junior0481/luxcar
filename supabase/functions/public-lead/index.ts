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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!supabaseUrl || !serviceKey || !turnstileSecret) {
      console.error('Configuração ausente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou TURNSTILE_SECRET_KEY.');
      return json({ error: 'Serviço temporariamente indisponível.' }, 500);
    }

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Dados do formulário inválidos.' }, 400);
    }
    const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : '';
    const vehicleId = typeof body.vehicle_id === 'string' ? body.vehicle_id.trim() : '';
    const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
    const customerEmail = typeof body.customer_email === 'string' ? body.customer_email.trim() : '';
    const customerPhone = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const token = typeof body.turnstile_token === 'string' ? body.turnstile_token.trim() : '';

    if (!UUID_RE.test(companyId) || !UUID_RE.test(vehicleId)) {
      return json({ error: 'Empresa ou veículo inválido.' }, 400);
    }
    if (customerName.length < 2 || customerName.length > 120) {
      return json({ error: 'Informe um nome com até 120 caracteres.' }, 400);
    }
    if (customerEmail.length > 254 || (customerEmail && !EMAIL_RE.test(customerEmail))) {
      return json({ error: 'E-mail inválido.' }, 400);
    }
    if (customerPhone.length > 30 || (customerPhone && customerPhone.replace(/\D/g, '').length < 8)) {
      return json({ error: 'Telefone inválido.' }, 400);
    }
    if (!customerEmail && !customerPhone) {
      return json({ error: 'Informe e-mail ou telefone para contato.' }, 400);
    }
    if (message.length > 2000) return json({ error: 'A mensagem excede o limite de 2000 caracteres.' }, 400);
    if (!token || token.length > 2048) return json({ error: 'Conclua a verificação antispam.' }, 400);

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const [{ data: company, error: companyError }, { data: vehicle, error: vehicleError }] = await Promise.all([
      service.from('companies').select('id').eq('id', companyId).eq('status', 'active').maybeSingle(),
      service.from('vehicles').select('id').eq('id', vehicleId).eq('company_id', companyId)
        .eq('status', 'disponivel').maybeSingle()
    ]);
    if (companyError || vehicleError) {
      console.error('Falha ao validar empresa/veículo do lead.', companyError ?? vehicleError);
      return json({ error: 'Não foi possível validar a empresa ou o veículo.' }, 500);
    }
    if (!company || !vehicle) return json({ error: 'Este veículo não está disponível para contato.' }, 400);

    const verificationBody = new URLSearchParams({ secret: turnstileSecret, response: token });
    const remoteIp = request.headers.get('cf-connecting-ip');
    if (remoteIp) verificationBody.set('remoteip', remoteIp);

    const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verificationBody,
      signal: AbortSignal.timeout(10_000)
    });
    if (!verificationResponse.ok) {
      console.error('Turnstile siteverify retornou HTTP', verificationResponse.status);
      return json({ error: 'Não foi possível validar a verificação antispam.' }, 502);
    }
    const verification = await verificationResponse.json();
    if (verification.success !== true) return json({ error: 'Verificação antispam inválida. Tente novamente.' }, 403);

    const { data: lead, error: insertError } = await service.from('leads').insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      message: message || null,
      assigned_to: null,
      source: 'website',
      status: 'new'
    }).select('*').single();

    if (insertError) {
      console.error('Falha ao inserir lead público.', insertError);
      return json({ error: 'Não foi possível enviar sua mensagem agora.' }, 500);
    }
    return json({ success: true, lead }, 201);
  } catch (error) {
    console.error('Erro inesperado no envio do lead público.', error);
    return json({ error: 'Erro inesperado ao enviar sua mensagem.' }, 500);
  }
});
