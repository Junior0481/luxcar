import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeAction } from './authorization.ts';

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
    const setProvisionedProfile = async (userId: string, role: string, companyId: string) => {
      const { error } = await service.from('profiles').update({ role, company_id: companyId }).eq('id', userId);
      if (!error) return null;

      const { error: deleteError } = await service.auth.admin.deleteUser(userId);
      return deleteError
        ? `${error.message}; também não foi possível remover o usuário criado: ${deleteError.message}`
        : error.message;
    };
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sessão inválida.' }, 401);

    const { data: caller } = await service.from('profiles').select('id, role, company_id').eq('id', user.id).single();
    if (!caller) return json({ error: 'Perfil não encontrado.' }, 403);

    const body = await request.json();
    const actionAuthorization = authorizeAction(body.action, caller);
    if (!actionAuthorization.allowed) return json({ error: actionAuthorization.error }, actionAuthorization.status);
    const addBillingPeriod = (from: Date, cycle: 'monthly' | 'annual') => {
      const result = new Date(from);
      if (cycle === 'annual') result.setUTCFullYear(result.getUTCFullYear() + 1);
      else result.setUTCMonth(result.getUTCMonth() + 1);
      return result.toISOString();
    };
    const logPlatformAction = async (eventType: string, companyId: string | null, details: Record<string, unknown> = {}, requestId: string | null = null) => {
      const { error } = await service.from('platform_admin_audit').insert({
        actor_id: user.id, company_id: companyId, subscription_request_id: requestId,
        event_type: eventType, details
      });
      return error;
    };

    if (body.action === 'platform_overview') {
      const [companiesResult, requestsResult, paymentsResult, auditResult] = await Promise.all([
        service.from('companies').select('*').order('created_at', { ascending: false }).limit(200),
        service.from('subscription_requests').select('*').order('created_at', { ascending: false }).limit(200),
        service.from('subscription_payments').select('*').order('created_at', { ascending: false }).limit(300),
        service.from('platform_admin_audit').select('*').order('created_at', { ascending: false }).limit(100)
      ]);
      const loadError = companiesResult.error || requestsResult.error || paymentsResult.error || auditResult.error;
      if (loadError) return json({ error: `Não foi possível carregar a administração da plataforma: ${loadError.message}` }, 500);

      const companies = companiesResult.data || [];
      const companyIds = companies.map((company) => company.id);
      const relatedUserIds = [...new Set([
        ...companies.map((company) => company.owner_user_id).filter(Boolean),
        ...(auditResult.data || []).map((entry) => entry.actor_id).filter(Boolean)
      ])];
      const [profilesResult, membersResult, vehiclesResult] = companyIds.length ? await Promise.all([
        relatedUserIds.length ? service.from('profiles').select('id, email, full_name, role').in('id', relatedUserIds) : Promise.resolve({ data: [], error: null }),
        service.from('profiles').select('company_id').in('company_id', companyIds),
        service.from('vehicles').select('company_id').in('company_id', companyIds)
      ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
      const detailError = profilesResult.error || membersResult.error || vehiclesResult.error;
      if (detailError) return json({ error: `Não foi possível carregar detalhes das concessionárias: ${detailError.message}` }, 500);
      const requests = requestsResult.data || [];
      const requestedPlanIds = [...new Set(requests.map((item) => item.plan).filter(Boolean))];
      const requestPlansResult = requestedPlanIds.length
        ? await service.from('plans').select('id,name,monthly_price,annual_price').in('id', requestedPlanIds)
        : { data: [], error: null };
      if (requestPlansResult.error) return json({ error: `Não foi possível carregar os planos das solicitações: ${requestPlansResult.error.message}` }, 500);
      const requestPlans = new Map((requestPlansResult.data || []).map((plan) => [plan.id, plan]));
      const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
      const ownerCounts = new Map<string, number>();
      const vehicleCounts = new Map<string, number>();
      for (const row of membersResult.data || []) ownerCounts.set(row.company_id, (ownerCounts.get(row.company_id) || 0) + 1);
      for (const row of vehiclesResult.data || []) vehicleCounts.set(row.company_id, (vehicleCounts.get(row.company_id) || 0) + 1);
      const paymentsByCompany = new Map<string, unknown[]>();
      for (const payment of paymentsResult.data || []) {
        const existing = paymentsByCompany.get(payment.company_id) || [];
        existing.push(payment);
        paymentsByCompany.set(payment.company_id, existing);
      }
      return json({
        companies: companies.map((company) => ({
          ...company, owner: company.owner_user_id ? profilesById.get(company.owner_user_id) || null : null,
          member_count: ownerCounts.get(company.id) || 0, vehicle_count: vehicleCounts.get(company.id) || 0,
          payments: paymentsByCompany.get(company.id) || []
        })),
        requests: requests.map((request) => {
          const plan = request.plan ? requestPlans.get(request.plan) : null;
          const cycle = request.billing_cycle === 'annual' ? 'annual' : 'monthly';
          return {
            ...request,
            plan_name: plan?.name || 'Plano não informado',
            plan_amount: request.quoted_amount ?? (plan ? (cycle === 'annual' ? plan.annual_price : plan.monthly_price) : null)
          };
        }),
        audit: (auditResult.data || []).map((entry) => ({ ...entry, actor: entry.actor_id ? profilesById.get(entry.actor_id) || null : null }))
      });
    }

    if (body.action === 'set_company_status') {
      const { companyId, status } = body;
      if (!companyId || !['active', 'inactive', 'suspended'].includes(status)) return json({ error: 'Empresa ou status inválido.' }, 400);
      const { data: company, error } = await service.from('companies').update({ status }).eq('id', companyId).select('id, name, status').single();
      if (error || !company) return json({ error: error?.message || 'Concessionária não encontrada.' }, 404);
      const auditError = await logPlatformAction('company_status_changed', company.id, { status });
      if (auditError) return json({ error: `Status atualizado, mas a auditoria falhou: ${auditError.message}` }, 500);
      return json({ company });
    }

    if (body.action === 'confirm_renewal_payment') {
      const { companyId, paymentReference, amount } = body;
      const parsedAmount = amount === '' || amount === null || amount === undefined ? null : Number(amount);
      if (!companyId || !paymentReference?.trim() || (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0))) {
        return json({ error: 'Informe uma referência de pagamento e um valor válido.' }, 400);
      }
      const { data: company, error: companyError } = await service.from('companies').select('id, name, billing_cycle, current_period_end').eq('id', companyId).single();
      if (companyError || !company) return json({ error: 'Concessionária não encontrada.' }, 404);
      const now = new Date();
      const cycle = company.billing_cycle === 'annual' ? 'annual' as const : 'monthly' as const;
      // Renewal keeps the original due day; a lapse longer than one cycle restarts the period today.
      let periodStart = company.current_period_end || now.toISOString();
      let periodEnd = addBillingPeriod(new Date(periodStart), cycle);
      if (Date.parse(periodEnd) <= now.getTime()) {
        periodStart = now.toISOString();
        periodEnd = addBillingPeriod(now, cycle);
      }
      const { data: payment, error: paymentError } = await service.from('subscription_payments').insert({
        company_id: company.id, payment_reference: paymentReference.trim(), amount: parsedAmount,
        period_start: periodStart, period_end: periodEnd,
        status: 'confirmed', confirmed_by: user.id, confirmed_at: now.toISOString()
      }).select('*').single();
      if (paymentError || !payment) return json({ error: paymentError?.message || 'Não foi possível registrar o pagamento.' }, 500);
      const { error: updateError } = await service.from('companies').update({
        current_period_end: payment.period_end, cancelled_at: null
      }).eq('id', company.id);
      if (updateError) {
        await service.from('subscription_payments').delete().eq('id', payment.id);
        return json({ error: `Pagamento registrado, mas a renovação falhou: ${updateError.message}` }, 500);
      }
      const auditError = await logPlatformAction('subscription_payment_confirmed', company.id, {
        payment_id: payment.id, payment_reference: payment.payment_reference, amount: payment.amount,
        period_start: payment.period_start, period_end: payment.period_end, manual: true
      });
      if (auditError) return json({ error: `Renovação concluída, mas a auditoria falhou: ${auditError.message}` }, 500);
      return json({ payment });
    }

    if (body.action === 'mark_owner_access_delivered') {
      const { companyId } = body;
      const deliveredAt = new Date().toISOString();
      const { data: company, error } = await service.from('companies').update({ owner_access_delivered_at: deliveredAt }).eq('id', companyId).select('id, name, owner_access_delivered_at').single();
      if (error || !company) return json({ error: error?.message || 'Concessionária não encontrada.' }, 404);
      const auditError = await logPlatformAction('owner_access_marked_delivered', company.id, { delivered_at: deliveredAt });
      if (auditError) return json({ error: `Acesso marcado, mas a auditoria falhou: ${auditError.message}` }, 500);
      return json({ company });
    }

    if (body.action === 'mark_owner_first_login') {
      const { data: company, error } = await service.from('companies').select('id, owner_user_id, owner_first_login_at').eq('id', caller.company_id).single();
      if (error || !company || company.owner_user_id !== user.id) return json({ success: true, recorded: false });
      if (company.owner_first_login_at) return json({ success: true, recorded: false });
      const firstLoginAt = new Date().toISOString();
      const { error: updateError } = await service.from('companies').update({ owner_first_login_at: firstLoginAt }).eq('id', company.id).is('owner_first_login_at', null);
      if (updateError) return json({ error: 'Não foi possível registrar o primeiro acesso.' }, 500);
      const auditError = await logPlatformAction('owner_first_login', company.id, { first_login_at: firstLoginAt });
      if (auditError) return json({ error: 'Primeiro acesso registrado, mas a auditoria falhou.' }, 500);
      return json({ success: true, recorded: true });
    }

    if (body.action === 'mark_onboarding_ready') {
      const { data: company, error: readError } = await service.from('companies').select('id, name, owner_access_delivered_at, owner_first_login_at').eq('id', body.companyId).single();
      if (readError || !company) return json({ error: 'Concessionária não encontrada.' }, 404);
      if (!company.owner_access_delivered_at || !company.owner_first_login_at) return json({ error: 'Entregue o acesso e aguarde o primeiro login do proprietário antes de concluir a implantação.' }, 409);
      const completedAt = new Date().toISOString();
      const { error } = await service.from('companies').update({ onboarding_completed_at: completedAt }).eq('id', company.id);
      if (error) return json({ error: error.message }, 500);
      const auditError = await logPlatformAction('onboarding_completed', company.id, { completed_at: completedAt });
      if (auditError) return json({ error: `Implantação concluída, mas a auditoria falhou: ${auditError.message}` }, 500);
      return json({ company: { id: company.id, name: company.name, onboarding_completed_at: completedAt } });
    }

    if (body.action === 'create_owner_recovery_link') {
      const { data: company, error: companyError } = await service.from('companies').select('id, name, owner_user_id').eq('id', body.companyId).single();
      if (companyError || !company?.owner_user_id) return json({ error: 'Proprietário não encontrado para esta concessionária.' }, 404);
      const { data: owner, error: ownerError } = await service.from('profiles').select('id, email').eq('id', company.owner_user_id).single();
      if (ownerError || !owner?.email) return json({ error: 'Email do proprietário não encontrado.' }, 404);
      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({ type: 'recovery', email: owner.email });
      if (linkError || !linkData.properties?.action_link) return json({ error: linkError?.message || 'Não foi possível gerar um link de recuperação.' }, 500);
      const auditError = await logPlatformAction('owner_recovery_link_generated', company.id, { owner_id: owner.id });
      if (auditError) return json({ error: `Link gerado, mas o registro de auditoria falhou: ${auditError.message}` }, 500);
      return json({ company: company.name, email: owner.email, action_link: linkData.properties.action_link });
    }

    if (body.action === 'confirm_payment_and_provision') {
      const { requestId, adminPassword } = body;
      if (!requestId || typeof adminPassword !== 'string' || adminPassword.length < 8) {
        return json({ error: 'Solicitação ou senha temporária inválida. A senha deve ter pelo menos 8 caracteres.' }, 400);
      }

      const { data: subscriptionRequest, error: claimError } = await service
        .from('subscription_requests')
        .update({ status: 'provisioning' })
        .eq('id', requestId)
        .eq('status', 'pending_payment')
        .select('*')
        .single();
      if (claimError || !subscriptionRequest) {
        return json({ error: 'Solicitação não encontrada, já processada ou em processamento.' }, 409);
      }
      const resetRequest = () => service.from('subscription_requests').update({ status: 'pending_payment' }).eq('id', requestId).eq('status', 'provisioning');

      const planId = subscriptionRequest.plan || 'platinum';
      const cycle = subscriptionRequest.billing_cycle === 'annual' ? 'annual' as const : 'monthly' as const;
      const { data: selectedPlan, error: selectedPlanError } = await service.from('plans')
        .select('id,monthly_price,annual_price,max_vehicles,max_administrators,max_sellers').eq('id', planId).single();
      if (selectedPlanError || !selectedPlan) {
        await resetRequest();
        return json({ error: 'Plano da solicitação não encontrado.' }, 400);
      }
      const { data: existingOwner, error: existingOwnerError } = await service.from('profiles')
        .select('id,email,full_name,role,company_id').eq('email', subscriptionRequest.owner_email).maybeSingle();
      if (existingOwnerError) {
        await resetRequest();
        return json({ error: 'Não foi possível localizar o perfil do proprietário.' }, 500);
      }
      if (existingOwner) {
        const { data: existingAuth, error: existingAuthError } = await service.auth.admin.getUserById(existingOwner.id);
        if (existingOwner.role !== 'vendedor' || existingOwner.company_id || existingAuthError
          || !existingAuth.user?.email_confirmed_at
          || existingAuth.user.email?.toLowerCase() !== subscriptionRequest.owner_email.toLowerCase()) {
          await resetRequest();
          return json({ error: 'O email já está vinculado a uma conta que não pode ser usada como proprietário.' }, 409);
        }
      }
      const startedAt = new Date();
      const periodEnd = addBillingPeriod(startedAt, cycle);
      const { data: company, error: companyError } = await service.from('companies').insert({
        name: subscriptionRequest.company_name,
        slug: subscriptionRequest.slug,
        email: subscriptionRequest.owner_email,
        phone: subscriptionRequest.phone,
        postal_code: subscriptionRequest.postal_code,
        address: subscriptionRequest.address,
        address_number: subscriptionRequest.address_number,
        neighborhood: subscriptionRequest.neighborhood,
        city: subscriptionRequest.city,
        state: subscriptionRequest.state,
        status: 'active',
        plan: planId,
        max_vehicles: selectedPlan.max_vehicles,
        max_users: selectedPlan.max_administrators + selectedPlan.max_sellers,
        subscription_status: 'active', billing_cycle: cycle,
        subscription_started_at: startedAt.toISOString(), current_period_end: periodEnd
      }).select('*').single();
      if (companyError || !company) {
        await resetRequest();
        return json({ error: companyError?.message || 'Não foi possível criar a concessionária.' }, 400);
      }

      let ownerUserId = existingOwner?.id;
      let createdUserId: string | null = null;
      if (existingOwner) {
        const { error: profileError } = await service.from('profiles').update({
          full_name: subscriptionRequest.owner_name, role: 'administrador', company_id: company.id
        }).eq('id', existingOwner.id);
        if (profileError) {
          await service.from('companies').delete().eq('id', company.id);
          await resetRequest();
          return json({ error: `Não foi possível vincular o perfil do proprietário: ${profileError.message}` }, 500);
        }
      } else {
        const { data: created, error: authError } = await service.auth.admin.createUser({
          email: subscriptionRequest.owner_email,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { full_name: subscriptionRequest.owner_name, role: 'administrador', company_id: company.id }
        });
        if (authError || !created.user) {
          await service.from('companies').delete().eq('id', company.id);
          await resetRequest();
          return json({ error: authError?.message || 'Não foi possível criar o acesso do proprietário.' }, 400);
        }
        ownerUserId = created.user.id;
        createdUserId = created.user.id;

        const profileError = await setProvisionedProfile(created.user.id, 'administrador', company.id);
        if (profileError) {
          await service.from('companies').delete().eq('id', company.id);
          await resetRequest();
          return json({ error: `Não foi possível configurar o perfil: ${profileError}` }, 500);
        }
      }
      if (!ownerUserId) {
        await service.from('companies').delete().eq('id', company.id);
        await resetRequest();
        return json({ error: 'Não foi possível identificar a conta do proprietário.' }, 500);
      }
      const rollbackOwnerAndCompany = async () => {
        if (existingOwner) {
          await service.from('profiles').update({
            full_name: existingOwner.full_name, role: existingOwner.role, company_id: existingOwner.company_id
          }).eq('id', existingOwner.id);
        } else if (createdUserId) {
          await service.auth.admin.deleteUser(createdUserId);
        }
        await service.from('companies').delete().eq('id', company.id);
      };

      const { error: ownerError } = await service.from('companies').update({ owner_user_id: ownerUserId }).eq('id', company.id);
      if (ownerError) {
        await rollbackOwnerAndCompany();
        await resetRequest();
        return json({ error: `Não foi possível registrar o proprietário: ${ownerError.message}` }, 500);
      }

      const { data: initialPayment, error: initialPaymentError } = await service.from('subscription_payments').insert({
        company_id: company.id, subscription_request_id: requestId,
        payment_reference: subscriptionRequest.payment_reference,
        amount: subscriptionRequest.quoted_amount ?? (cycle === 'annual' ? selectedPlan.annual_price : selectedPlan.monthly_price),
        period_start: startedAt.toISOString(), period_end: periodEnd,
        status: 'confirmed', confirmed_by: user.id, confirmed_at: startedAt.toISOString()
      }).select('id').single();
      if (initialPaymentError) {
        await rollbackOwnerAndCompany();
        await resetRequest();
        return json({ error: `Não foi possível registrar o pagamento inicial: ${initialPaymentError.message}` }, 500);
      }

      const { error: requestUpdateError } = await service.from('subscription_requests').update({
        status: 'provisioned', payment_confirmed_at: new Date().toISOString(), company_id: company.id
      }).eq('id', requestId).eq('status', 'provisioning');
      if (requestUpdateError) {
        await service.from('subscription_payments').delete().eq('subscription_request_id', requestId);
        await rollbackOwnerAndCompany();
        await resetRequest();
        return json({ error: `Não foi possível concluir a solicitação: ${requestUpdateError.message}` }, 500);
      }

      if (existingOwner) {
        const { error: authUpdateError } = await service.auth.admin.updateUserById(existingOwner.id, {
          password: adminPassword,
          user_metadata: { full_name: subscriptionRequest.owner_name, role: 'administrador', company_id: company.id }
        });
        if (authUpdateError) {
          await service.from('subscription_payments').delete().eq('subscription_request_id', requestId);
          await service.from('subscription_requests').update({
            status: 'pending_payment', payment_confirmed_at: null, company_id: null
          }).eq('id', requestId).eq('status', 'provisioned');
          await rollbackOwnerAndCompany();
          return json({ error: `Não foi possível definir o acesso do proprietário: ${authUpdateError.message}` }, 500);
        }
      }

      const auditError = await logPlatformAction('subscription_payment_confirmed', company.id, {
        payment_id: initialPayment.id, payment_reference: subscriptionRequest.payment_reference,
        plan: planId, billing_cycle: cycle,
        period_start: startedAt.toISOString(), period_end: periodEnd, provisioned_admin_id: ownerUserId
      }, requestId);
      if (auditError) return json({ error: `Concessionária provisionada, mas o registro de auditoria falhou: ${auditError.message}` }, 500);
      return json({ company: { id: company.id, name: company.name, slug: company.slug }, user: { id: ownerUserId, email: subscriptionRequest.owner_email }, status: 'provisioned' }, 201);
    }

    if (body.action === 'create_member') {
      const { fullName, email, password, role } = body;
      if (!fullName || !email || !password || !['administrador', 'vendedor'].includes(role)) return json({ error: 'Dados de usuário inválidos.' }, 400);
      if (typeof password !== 'string' || password.length < 8) return json({ error: 'A senha inicial deve ter pelo menos 8 caracteres.' }, 400);
      const { count } = await service.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', caller.company_id);
      const { data: company } = await service.from('companies').select('max_users').eq('id', caller.company_id).single();
      if (company && (count || 0) >= company.max_users) return json({ error: 'Limite de usuários do plano atingido.' }, 409);

      const { data: created, error } = await service.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, role, company_id: caller.company_id }
      });
      if (error) {
        console.error('create_member failed:', error.message);
        const taken = /already|registered|exists/i.test(error.message);
        return json({ error: taken ? 'Já existe uma conta com este email.' : 'Não foi possível criar o usuário. Confira os dados e tente novamente.' }, taken ? 409 : 400);
      }
      const profileError = await setProvisionedProfile(created.user.id, role, caller.company_id);
      if (profileError) {
        console.error('create_member profile failed:', profileError);
        const limit = profileError.match(/Limite de [^;]+? atingido\./)?.[0];
        return json({ error: limit || 'Não foi possível configurar o perfil do usuário.' }, limit ? 409 : 500);
      }
      return json({ user: { id: created.user.id, email: created.user.email } }, 201);
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    console.error('admin-provision failed:', error);
    return json({ error: 'Erro inesperado. Tente novamente.' }, 500);
  }
});
