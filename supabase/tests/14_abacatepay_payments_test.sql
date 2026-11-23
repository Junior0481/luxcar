-- AbacatePay: pagamento confirmado cria a empresa (cadastro) ou renova (assinatura), sem duplicar.
begin;
\ir _fixtures.psql
select plan(13);

:as_postgres
-- Cadastro: dono confirmou o email (conta sem empresa) e tem pedido aguardando pagamento.
set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at) values ('c0000000-0000-0000-0000-0000000000c1', 'dono@novaloja.test', now());
insert into public.profiles (id, email, full_name, role, company_id) values ('c0000000-0000-0000-0000-0000000000c1', 'dono@novaloja.test', 'Dono', 'vendedor', null);
set local session_replication_role = origin;
insert into public.subscription_requests (id, company_name, slug, owner_name, owner_email, postal_code, address, address_number, neighborhood, city, state, plan, billing_cycle, quoted_amount, status)
values ('c0000000-0000-0000-0000-0000000000a1', 'Nova Loja', 'nova-loja', 'Dono da Nova', 'dono@novaloja.test', '01001000', 'Praça da Sé', '10', 'Sé', 'São Paulo', 'SP', 'gold', 'annual', 8500, 'pending_payment');
insert into public.payment_charges (provider_charge_id, kind, subscription_request_id, plan, billing_cycle, amount, checkout_url)
values ('bill_signup', 'signup', 'c0000000-0000-0000-0000-0000000000a1', 'gold', 'annual', 8500, 'https://pay.test/bill_signup');

select is(public.apply_paid_charge('bill_signup', 8500)->>'status', 'applied', 'pagamento do cadastro é aplicado');
select is((select status from public.subscription_requests where id = 'c0000000-0000-0000-0000-0000000000a1'), 'provisioned',
  'pedido passa a provisionado');
select is((select plan || '/' || billing_cycle || '/' || subscription_status from public.companies where slug = 'nova-loja'), 'gold/annual/active',
  'empresa criada no plano e ciclo do cadastro, ativa');
select is((select current_period_end::date from public.companies where slug = 'nova-loja'), (now() + interval '1 year')::date,
  'vencimento anual no mesmo dia');
select is((select role || '/' || (company_id = (select id from public.companies where slug = 'nova-loja'))::text from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c1'),
  'administrador/true', 'dono vira administrador da nova empresa');
select is(public.apply_paid_charge('bill_signup', 8500)->>'status', 'already_processed', 'webhook repetido é ignorado');
select is((select count(*)::int from public.companies where slug = 'nova-loja'), 1, 'webhook repetido não cria outra empresa');
select is((select count(*)::int from public.subscription_payments where provider_charge_id = 'bill_signup'), 1, 'nem outro pagamento');

-- Renovação: loja A vencida há 3 dias renova mantendo o dia do vencimento.
update public.companies set current_period_end = date_trunc('second', now()) - interval '3 days', billing_cycle = 'monthly'
where id = 'a0000000-0000-0000-0000-000000000001';
insert into public.payment_charges (provider_charge_id, kind, company_id, plan, billing_cycle, amount, checkout_url)
values ('bill_renewal', 'renewal', 'a0000000-0000-0000-0000-000000000001', 'silver', 'monthly', 400, 'https://pay.test/bill_renewal');
select is(public.apply_paid_charge('bill_renewal', 400)->>'status', 'applied', 'renovação aplicada');
select is((select current_period_end from public.companies where id = 'a0000000-0000-0000-0000-000000000001'),
  date_trunc('second', now()) - interval '3 days' + interval '1 month', 'novo vencimento no mesmo dia do mês');
select is((select subscription_status from public.companies where id = 'a0000000-0000-0000-0000-000000000001'), 'active',
  'renovação volta a assinatura para ativa');

-- Valor menor que o cobrado não é aplicado; ninguém além do service_role chama a função.
insert into public.payment_charges (provider_charge_id, kind, company_id, plan, billing_cycle, amount, checkout_url)
values ('bill_short', 'renewal', 'a0000000-0000-0000-0000-000000000001', 'silver', 'monthly', 400, 'https://pay.test/bill_short');
select throws_ok($$select public.apply_paid_charge('bill_short', 100)$$, '23514', null, 'pagamento parcial é recusado');
:as_admin_a
select throws_ok($$select public.apply_paid_charge('bill_short', 400)$$, '42501', null, 'lojista não confirma pagamento pela API');

select * from finish();
rollback;
