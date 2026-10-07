-- Isolamento entre lojas + decisão de produto:
--   vendedor vê SÓ os próprios leads e negociações; admin vê toda a loja.
begin;
\ir _fixtures.psql
select plan(22);

-- Vendedor A
:as_seller_a
select is(rls_test.visible('select 1 from public.negotiations'), 1, 'vendedor A vê só a própria negociação');
select is(rls_test.visible('select 1 from public.negotiations where seller_id <> ''a0000000-0000-0000-0000-0000000000a1'''), 0, 'vendedor A não vê negociação do colega A2');
select is(rls_test.visible('select 1 from public.leads'), 1, 'vendedor A vê só o próprio lead');
select is(rls_test.visible('select 1 from public.interaction_history'), 1, 'vendedor A vê só o histórico das próprias negociações');
select is(rls_test.visible('select 1 from public.trade_in_vehicles where company_id = ''b0000000-0000-0000-0000-000000000001'''), 0, 'vendedor A não vê trocas da loja B');
select is(rls_test.visible('select 1 from public.vehicles'), 1, 'vendedor A vê o estoque da loja A (não o da B)');
select is(rls_test.visible('select 1 from public.customers'), 0, 'vendedor A não lista clientes finais');
select is(rls_test.visible('select 1 from public.companies'), 1, 'vendedor A vê só a própria loja');

select is(rls_test.affected($$update public.negotiations set notes = 'x' where id = 'a0000000-0000-0000-0000-00000000f102'$$),
  0, 'vendedor A não altera negociação do colega A2');

select throws_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'x')$$,
  '42501', null, 'P1-1: vendedor A não cria negociação com veículo da loja B');

select throws_ok(
  $$insert into public.payments (company_id, negotiation_id, amount, method, created_by)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000f101', 100, 'pix', 'a0000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'P1-1: pagamento não aponta para negociação da loja B');

-- Admin A
:as_admin_a
select is(rls_test.visible('select 1 from public.negotiations'), 2, 'admin A vê todas as negociações da loja A');
select is(rls_test.visible('select 1 from public.leads'), 2, 'admin A vê todos os leads da loja A');
select is(rls_test.visible('select 1 from public.negotiations where company_id = ''b0000000-0000-0000-0000-000000000001'''), 0, 'admin A não vê negociações da loja B');
select is(rls_test.visible('select 1 from public.leads where company_id = ''b0000000-0000-0000-0000-000000000001'''), 0, 'admin A não vê leads da loja B');
select is(rls_test.affected($$update public.vehicles set sale_price = 1 where id = 'b0000000-0000-0000-0000-00000000f001'$$),
  0, 'admin A não altera veículo da loja B');
select is(rls_test.affected($$update public.companies set name = 'hack' where id = 'b0000000-0000-0000-0000-000000000001'$$),
  0, 'admin A não altera a loja B');

-- Vendedor B
:as_seller_b
select is(rls_test.visible('select 1 from public.negotiations'), 1, 'vendedor B vê só a própria negociação');
select is(rls_test.visible('select 1 from public.profiles where company_id = ''a0000000-0000-0000-0000-000000000001'''), 0, 'vendedor B não vê a equipe da loja A');
select is(rls_test.visible('select 1 from public.sales where company_id = ''a0000000-0000-0000-0000-000000000001'''), 0, 'vendedor B não vê vendas da loja A');

-- Anon
:as_anon
select is(rls_test.visible('select 1 from public.negotiations'), 0, 'anon não lê negociações');
select lives_ok(
  $$insert into public.leads (company_id, customer_name, customer_email) values ('a0000000-0000-0000-0000-000000000001', 'Visitante', 'v@test.local')$$,
  'anon ainda consegue enviar lead pelo formulário público');

select * from finish();
rollback;
