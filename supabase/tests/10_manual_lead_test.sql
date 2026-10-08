-- T11 (ded4f66, migration 1700): lead manual criado por usuário logado da loja.
--   vendedor cria para si; não atribui a colega. Admin atribui a vendedor da própria loja,
--   nunca de outra. vehicle_id NULL é permitido; veículo de outra loja não.
begin;
\ir _fixtures.psql
select plan(9);

-- Vendedor A
:as_seller_a
select lives_ok(
  $$insert into public.leads (company_id, vehicle_id, customer_name, assigned_to)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'Manual SA', 'a0000000-0000-0000-0000-0000000000a1')$$,
  'vendedor A cria lead manual atribuído a si mesmo');
select throws_ok(
  $$insert into public.leads (company_id, customer_name, assigned_to)
    values ('a0000000-0000-0000-0000-000000000001', 'Manual p/ colega', 'a0000000-0000-0000-0000-0000000000a2')$$,
  '42501', null, 'vendedor A não cria lead atribuído ao colega A2');
select throws_ok(
  $$insert into public.leads (company_id, customer_name, assigned_to)
    values ('b0000000-0000-0000-0000-000000000001', 'Manual na loja B', 'a0000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'vendedor A não cria lead na loja B');

-- Admin A
:as_admin_a
select lives_ok(
  $$insert into public.leads (company_id, customer_name, assigned_to)
    values ('a0000000-0000-0000-0000-000000000001', 'Manual admin→A2', 'a0000000-0000-0000-0000-0000000000a2')$$,
  'admin A cria lead atribuído ao vendedor A2 (mesma loja)');
select throws_ok(
  $$insert into public.leads (company_id, customer_name, assigned_to)
    values ('a0000000-0000-0000-0000-000000000001', 'Manual admin→B', 'b0000000-0000-0000-0000-0000000000b1')$$,
  '42501', null, 'admin A não atribui lead a vendedor da loja B');
select lives_ok(
  $$insert into public.leads (company_id, vehicle_id, customer_name)
    values ('a0000000-0000-0000-0000-000000000001', null, 'Manual sem veículo')$$,
  'lead manual sem veículo (vehicle_id NULL) é aceito');
select throws_ok(
  $$insert into public.leads (company_id, vehicle_id, customer_name)
    values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000f001', 'Manual veículo B')$$,
  '42501', null, 'lead manual não aponta para veículo da loja B');

-- O lead criado aparece para quem deve ver
:as_seller_a2
select is(rls_test.visible('select 1 from public.leads where customer_name = ''Manual admin→A2'''),
  1, 'vendedor A2 vê o lead que o admin atribuiu a ele');
:as_seller_a
select is(rls_test.visible('select 1 from public.leads where customer_name = ''Manual admin→A2'''),
  0, 'vendedor A não vê o lead atribuído ao colega');

select * from finish();
rollback;
