-- P0-4: views de relatório respeitam tenant e não são públicas.
begin;
\ir _fixtures.psql
select plan(6);

select ok(not has_table_privilege('anon', 'public.dashboard_metrics', 'select'),
  'P0-4: anon sem SELECT em dashboard_metrics');
select ok(not has_table_privilege('anon', 'public.vehicles_with_negotiations', 'select'),
  'P0-4: anon sem SELECT em vehicles_with_negotiations');

:as_anon
select is(rls_test.visible('select 1 from public.vehicles_with_negotiations'), 0,
  'P0-4: anon não lê vehicles_with_negotiations');

:as_seller_b
select is(rls_test.visible('select 1 from public.vehicles_with_negotiations'), 1,
  'P0-4: vendedor B vê só o veículo da loja B na view');
select is(rls_test.visible('select 1 from public.vehicles_with_negotiations where company_id = ''a0000000-0000-0000-0000-000000000001'''), 0,
  'P0-4: vendedor B não vê veículos da loja A pela view');

:as_admin_a
select is((select vehicles_available::int from public.dashboard_metrics), 1,
  'P0-4: dashboard_metrics do admin A conta só a loja A (1 disponível, não 2)');

select * from finish();
rollback;
