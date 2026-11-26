-- Endurecimento: lojista não mexe na cobrança, email do perfil não decide o dono, suspensão corta acesso.
begin;
\ir _fixtures.psql
select plan(19);

set local session_replication_role = replica;
insert into auth.users (id, email) values ('c0000000-0000-0000-0000-0000000000f1', 'plat@test.local');
insert into public.profiles (id, email, full_name, role, company_id) values
  ('c0000000-0000-0000-0000-0000000000f1', 'plat@test.local', 'Plataforma', 'platform_admin', null);
set local session_replication_role = origin;
\set as_platform 'reset role; do $$ begin perform set_config(''request.jwt.claims'', ''{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated"}'', true); end $$; set local role authenticated;'

-- 1. Colunas de cobrança e identidade da empresa.
:as_admin_a
select throws_ok($$update public.companies set current_period_end = '2099-12-31' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'lojista não estende o próprio vencimento');
select throws_ok($$update public.companies set subscription_status = 'cancelled' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'lojista não cancela a assinatura para fugir do bloqueio');
select throws_ok($$update public.companies set status = 'inactive' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'lojista não altera o status da empresa');
select throws_ok($$update public.companies set custom_domain = 'loja-alheia.com.br' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'lojista não reserva domínio');
select is(rls_test.affected($$update public.companies set name = 'Loja A Nova', primary_color = '#000000' where id = 'a0000000-0000-0000-0000-000000000001'$$),
  1, 'lojista continua editando nome e cores');
:as_platform
select is(rls_test.affected($$update public.companies set custom_domain = 'loja-a.com.br' where id = 'a0000000-0000-0000-0000-000000000001'$$),
  1, 'plataforma define o domínio');

-- 2. Email do perfil segue o login.
:as_seller_b
select throws_ok($$update public.profiles set email = 'aa@test.local' where id = 'b0000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'vendedor não troca o email do perfil');
select is(rls_test.affected($$update public.profiles set full_name = 'Vendedor B2' where id = 'b0000000-0000-0000-0000-0000000000b1'$$),
  1, 'vendedor continua editando o nome');
:as_postgres
update auth.users set email = 'sb-novo@test.local' where id = 'b0000000-0000-0000-0000-0000000000b1';
select is((select email from public.profiles where id = 'b0000000-0000-0000-0000-0000000000b1'), 'sb-novo@test.local',
  'email confirmado no login é copiado para o perfil');

-- apply_paid_charge escolhe o dono pelo email de login, não pelo email gravado no perfil.
set local session_replication_role = replica;
insert into auth.users (id, email, email_confirmed_at) values
  ('c0000000-0000-0000-0000-0000000000c1', 'dono@novaloja.test', now()),
  ('c0000000-0000-0000-0000-0000000000c2', 'atacante@test.local', now());
insert into public.profiles (id, email, full_name, role, company_id) values
  ('c0000000-0000-0000-0000-0000000000c1', 'antigo@test.local', 'Dono', 'vendedor', null),
  ('c0000000-0000-0000-0000-0000000000c2', 'dono@novaloja.test', 'Atacante', 'vendedor', null);
set local session_replication_role = origin;
insert into public.subscription_requests (id, company_name, slug, owner_name, owner_email, postal_code, address, address_number, neighborhood, city, state, plan, billing_cycle, quoted_amount, status)
values ('c0000000-0000-0000-0000-0000000000a1', 'Nova Loja', 'nova-loja', 'Dono da Nova', 'dono@novaloja.test', '01001000', 'Praça da Sé', '10', 'Sé', 'São Paulo', 'SP', 'gold', 'monthly', 850, 'pending_payment');
insert into public.payment_charges (provider_charge_id, kind, subscription_request_id, plan, billing_cycle, amount, checkout_url)
values ('bill_owner', 'signup', 'c0000000-0000-0000-0000-0000000000a1', 'gold', 'monthly', 850, 'https://pay.test/bill_owner');
select throws_ok($$select public.apply_paid_charge('bill_owner', null)$$, '23514', null, 'webhook sem valor pago é recusado');
select is(public.apply_paid_charge('bill_owner', 850)->>'status', 'applied', 'pagamento do cadastro aplicado');
select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c1'), 'administrador',
  'dono pelo email de login vira administrador');
select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-0000000000c2'), 'vendedor',
  'perfil com email adulterado não leva a loja');

-- 3. Suspensão pela plataforma corta o acesso.
update public.companies set status = 'suspended' where id = 'b0000000-0000-0000-0000-000000000001';
:as_seller_b
select is(rls_test.visible('select 1 from public.vehicles'), 0, 'loja suspensa não lê dados');
select is((select company_status from public.current_company_subscription()), 'suspended',
  'lojista suspenso consegue saber que está suspenso');

-- 4. Preço acordado não é lido de fora.
:as_seller_b
select throws_ok($$select public.negotiation_agreed_price('a0000000-0000-0000-0000-00000000f101')$$,
  '42501', null, 'preço acordado de outra loja não é exposto');

-- 5. Fotos do estoque só por administrador.
:as_seller_a
select throws_ok($$insert into storage.objects (bucket_id, name) values ('vehicles', 'a0000000-0000-0000-0000-000000000001/vehicles/x.webp')$$,
  '42501', null, 'vendedor não envia foto do estoque');
:as_admin_a
select lives_ok($$insert into storage.objects (bucket_id, name) values ('vehicles', 'a0000000-0000-0000-0000-000000000001/vehicles/x.webp')$$,
  'administrador envia foto do estoque');

-- 6. Uma solicitação pendente por email.
:as_postgres
select throws_ok($$insert into public.subscription_requests (company_name, slug, owner_name, owner_email, postal_code, address, address_number, neighborhood, city, state, plan, billing_cycle, quoted_amount, status)
  values ('Outra', 'outra-loja', 'Fulano', 'fulano@test.local', '01001000', 'Rua', '1', 'Sé', 'São Paulo', 'SP', 'silver', 'monthly', 400, 'pending_payment'),
         ('Mais uma', 'mais-uma', 'Fulano', 'FULANO@test.local', '01001000', 'Rua', '1', 'Sé', 'São Paulo', 'SP', 'silver', 'monthly', 400, 'pending_payment')$$,
  '23505', null, 'segunda solicitação pendente do mesmo email é recusada');

select * from finish();
rollback;
