import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Não autenticado.' }, 401);

    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sessão inválida.' }, 401);

    const { data: caller } = await service.from('profiles').select('role, company_id').eq('id', user.id).single();
    if (!caller) return json({ error: 'Perfil não encontrado.' }, 403);

    const body = await request.json();
    if (body.action === 'create_company') {
      if (caller.role !== 'platform_admin') return json({ error: 'Apenas o administrador da plataforma pode criar empresas.' }, 403);
      const { name, slug, email, phone, city, state, primaryColor, secondaryColor, adminName, adminEmail, adminPassword } = body;
      if (!name || !slug || !adminName || !adminEmail || !adminPassword) return json({ error: 'Preencha os campos obrigatórios.' }, 400);

      const { data: company, error: companyError } = await service.from('companies').insert({
        name, slug, email: email || null, phone: phone || null, city: city || null, state: state || null,
        primary_color: primaryColor || '#f8a746', secondary_color: secondaryColor || '#111827', status: 'active'
      }).select('*').single();
      if (companyError) return json({ error: companyError.message }, 400);

      const { data: created, error: authError } = await service.auth.admin.createUser({
        email: adminEmail, password: adminPassword, email_confirm: true,
        user_metadata: { full_name: adminName, role: 'administrador', company_id: company.id }
      });
      if (authError) {
        await service.from('companies').delete().eq('id', company.id);
        return json({ error: authError.message }, 400);
      }
      return json({ company, user: { id: created.user.id, email: created.user.email } }, 201);
    }

    if (body.action === 'create_member') {
      if (caller.role !== 'administrador' || !caller.company_id) return json({ error: 'Apenas administradores da empresa podem criar usuários.' }, 403);
      const { fullName, email, password, role } = body;
      if (!fullName || !email || !password || !['administrador', 'vendedor'].includes(role)) return json({ error: 'Dados de usuário inválidos.' }, 400);
      const { count } = await service.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', caller.company_id);
      const { data: company } = await service.from('companies').select('max_users').eq('id', caller.company_id).single();
      if (company && (count || 0) >= company.max_users) return json({ error: 'Limite de usuários do plano atingido.' }, 409);

      const { data: created, error } = await service.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, role, company_id: caller.company_id }
      });
      if (error) return json({ error: error.message }, 400);
      return json({ user: { id: created.user.id, email: created.user.email } }, 201);
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500);
  }
});
