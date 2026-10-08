-- Gaps abertos no REVIEW-backend-T6 + T7 (0cb8853). Os blocos (a), (c) e (d)
-- documentam comportamento que DEVE falhar até a correção; (b) cobre a T7.
begin;
\ir _fixtures.psql
select plan(19);

-- Dados extras (como postgres): pagamentos, troca e venda na negociação f102 (do colega A2).
insert into public.payments (id, company_id, negotiation_id, amount, method, status, created_by) values
  ('a0000000-0000-0000-0000-00000000f411', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 1000, 'pix', 'pending', 'a0000000-0000-0000-0000-0000000000ad'),
  ('a0000000-0000-0000-0000-00000000f412', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102', 2000, 'pix', 'pending', 'a0000000-0000-0000-0000-0000000000ad');
insert into public.trade_in_vehicles (negotiation_id, company_id, brand, model, year) values
  ('a0000000-0000-0000-0000-00000000f102', 'a0000000-0000-0000-0000-000000000001', 'GM', 'Onix', 2018);
insert into public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, sale_date) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a2', 45000, current_date);

-- (a) Vendedor vê só os próprios registros também em payments / trocas / vendas / dashboard.
:as_seller_a
select is(rls_test.visible('select 1 from public.payments where negotiation_id = ''a0000000-0000-0000-0000-00000000f102'''),
  0, '(a) vendedor A não vê pagamentos da negociação do colega A2');
select is(rls_test.visible('select 1 from public.payments where negotiation_id = ''a0000000-0000-0000-0000-00000000f101'''),
  1, '(a) vendedor A vê os pagamentos da própria negociação');
select is(rls_test.visible('select 1 from public.trade_in_vehicles where negotiation_id = ''a0000000-0000-0000-0000-00000000f102'''),
  0, '(a) vendedor A não vê a troca da negociação do colega A2');
select is(rls_test.visible('select 1 from public.sales where seller_id <> ''a0000000-0000-0000-0000-0000000000a1'''),
  0, '(a) vendedor A não vê vendas do colega A2');
select is((select monthly_revenue from public.dashboard_metrics)::numeric,
  0::numeric, '(a) dashboard do vendedor A não soma a receita do colega A2');
:as_admin_a
select is(rls_test.visible('select 1 from public.payments where company_id = ''a0000000-0000-0000-0000-000000000001'''),
  2, '(a) admin A continua vendo todos os pagamentos da loja');
select is((select monthly_revenue from public.dashboard_metrics)::numeric,
  45000::numeric, '(a) dashboard do admin A soma a receita da loja');

-- (b) T7: integridade cross-tenant mesmo sem RLS (postgres) e Storage por prefixo da empresa.
:as_postgres
select throws_ok(
  $$insert into public.payments (company_id, negotiation_id, amount, method, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000f101', 1, 'pix', 'a0000000-0000-0000-0000-0000000000ad')$$,
  '23503', null, '(b) pagamento da loja A não aponta para negociação da loja B (FK composta)');
select throws_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'x')$$,
  '23503', null, '(b) negociação da loja A não usa veículo da loja B (FK composta)');
select throws_ok(
  $$insert into public.trade_in_vehicles (negotiation_id, company_id, brand, model, year)
    values ('b0000000-0000-0000-0000-00000000f101', 'a0000000-0000-0000-0000-000000000001', 'x', 'y', 2000)$$,
  '23503', null, '(b) troca da loja A não aponta para negociação da loja B (FK composta)');

insert into storage.objects (bucket_id, name) values
  ('vehicles', 'a0000000-0000-0000-0000-000000000001/a.jpg'),
  ('vehicles', 'b0000000-0000-0000-0000-000000000001/b.jpg');

:as_seller_a
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('vehicles', 'a0000000-0000-0000-0000-000000000001/novo.jpg')$$,
  '(b) vendedor A faz upload no prefixo da própria loja');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('vehicles', 'b0000000-0000-0000-0000-000000000001/x.jpg')$$,
  '42501', null, '(b) vendedor A não faz upload no prefixo da loja B');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('vehicles', 'sem-prefixo.jpg')$$,
  '42501', null, '(b) upload sem prefixo de empresa é recusado');
select is(rls_test.affected($$update storage.objects set metadata = '{}' where name = 'b0000000-0000-0000-0000-000000000001/b.jpg'$$),
  0, '(b) vendedor A não sobrescreve objeto da loja B');
select is(rls_test.affected($$delete from storage.objects where name = 'a0000000-0000-0000-0000-000000000001/a.jpg'$$),
  0, '(b) vendedor (não admin) não apaga imagem nem da própria loja');
:as_admin_a
select is(rls_test.affected($$delete from storage.objects where name = 'b0000000-0000-0000-0000-000000000001/b.jpg'$$),
  0, '(b) admin A não apaga imagem da loja B');

-- (c) Guard de profiles não pode ser contornado por função SECURITY DEFINER (dono postgres).
:as_postgres
create function rls_test.definer_set_role(target uuid, new_role text) returns void
language sql security definer set search_path = public
as $$ update public.profiles set role = new_role where id = target $$;
grant execute on function rls_test.definer_set_role(uuid, text) to authenticated;

:as_seller_a
select throws_ok(
  $$select rls_test.definer_set_role('a0000000-0000-0000-0000-0000000000a1', 'administrador')$$,
  null, null, '(c) guard bloqueia promoção via função SECURITY DEFINER (usar session_user, não current_user)');

-- (d) Lead público não escolhe vendedor nem status (vale também se o insert direto
--     de anon for fechado em favor da Edge Function com Turnstile).
:as_anon
select throws_ok(
  $$insert into public.leads (company_id, customer_name, assigned_to)
    values ('a0000000-0000-0000-0000-000000000001', 'Anon', 'a0000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, '(d) anon não cria lead já atribuído a um vendedor');
select throws_ok(
  $$insert into public.leads (company_id, customer_name, status)
    values ('a0000000-0000-0000-0000-000000000001', 'Anon', 'converted')$$,
  '42501', null, '(d) anon não cria lead com status diferente de new');
select * from finish();
rollback;
