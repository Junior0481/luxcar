-- Decisão do usuário (2026-10-07): o admin pode criar/atribuir negociação a um vendedor
-- da própria loja, nunca de outra loja. Vendedor não atribui negociação a colega.
begin;
\ir _fixtures.psql
select plan(7);

-- Admin A
:as_admin_a
select lives_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'Cliente via admin')$$,
  'admin A cria negociação atribuída ao vendedor A (mesma loja)');
select throws_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'b0000000-0000-0000-0000-0000000000b1', 'x')$$,
  '42501', null, 'admin A não cria negociação atribuída ao vendedor B (outra loja)');
select is(rls_test.affected($$update public.negotiations set seller_id = 'a0000000-0000-0000-0000-0000000000a2' where id = 'a0000000-0000-0000-0000-00000000f101'$$),
  1, 'admin A reatribui negociação para o vendedor A2 (mesma loja)');
select throws_ok(
  $$update public.negotiations set seller_id = 'b0000000-0000-0000-0000-0000000000b1' where id = 'a0000000-0000-0000-0000-00000000f102'$$,
  '42501', null, 'admin A não reatribui negociação para vendedor de outra loja');

-- Vendedor A
:as_seller_a
select throws_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a2', 'x')$$,
  '42501', null, 'vendedor A não cria negociação atribuída ao colega A2');
select lives_ok(
  $$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'Cliente do A')$$,
  'vendedor A cria negociação para si mesmo');

:as_postgres
insert into public.negotiations (id, company_id, vehicle_id, seller_id, client_name) values
  ('a0000000-0000-0000-0000-00000000f1a1', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'Outra do A');
:as_seller_a
select throws_ok(
  $$update public.negotiations set seller_id = 'a0000000-0000-0000-0000-0000000000a2' where id = 'a0000000-0000-0000-0000-00000000f1a1'$$,
  '42501', null, 'vendedor A não repassa a própria negociação para o colega A2');

select * from finish();
rollback;
