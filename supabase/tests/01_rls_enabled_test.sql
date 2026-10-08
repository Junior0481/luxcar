-- P0-1: toda tabela de public precisa de RLS ligada; anon não pode ler dados internos.
begin;
\ir _fixtures.psql
select plan(9);

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'P0-1: nenhuma tabela de public sem RLS habilitada'
);

select ok((select relrowsecurity from pg_class where oid = 'public.companies'::regclass),         'P0-1: RLS ligada em companies');
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass),         'P0-1: RLS ligada em customers');
select ok((select relrowsecurity from pg_class where oid = 'public.leads'::regclass),             'P0-1: RLS ligada em leads');
select ok((select relrowsecurity from pg_class where oid = 'public.trade_in_vehicles'::regclass), 'P0-1: RLS ligada em trade_in_vehicles');

:as_anon
select is(rls_test.visible('select 1 from public.customers'),         0, 'P0-1: anon não lê customers');
select is(rls_test.visible('select 1 from public.leads'),             0, 'P0-1: anon não lê leads');
select is(rls_test.visible('select 1 from public.trade_in_vehicles'), 0, 'P0-1: anon não lê trocas');
select is(rls_test.visible('select 1 from public.vehicles'),          0, 'P0-1: anon não lê a tabela vehicles (só a view pública)');

select * from finish();
rollback;
