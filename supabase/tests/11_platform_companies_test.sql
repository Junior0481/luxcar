-- platform_admin enxerga todas as empresas (tela "Empresas cadastradas").
-- Regressão: a 0800 derruba todas as policies de companies (inclusive as de plataforma
-- da 0300/0400) e recria só as de tenant; o platform_admin, sem company_id, vê 0 lojas.
begin;
\ir _fixtures.psql
select plan(4);

set local session_replication_role = replica;
insert into auth.users (id, email) values ('c0000000-0000-0000-0000-0000000000f1', 'plat@test.local');
insert into public.profiles (id, email, full_name, role, company_id) values
  ('c0000000-0000-0000-0000-0000000000f1', 'plat@test.local', 'Plataforma', 'platform_admin', null);
set local session_replication_role = origin;

\set as_platform 'reset role; do $$ begin perform set_config(''request.jwt.claims'', ''{"sub":"c0000000-0000-0000-0000-0000000000f1","role":"authenticated"}'', true); end $$; set local role authenticated;'

:as_platform
select is(rls_test.visible('select 1 from public.companies where id in (''a0000000-0000-0000-0000-000000000001'', ''b0000000-0000-0000-0000-000000000001'')'),
  2, 'platform_admin vê as lojas A e B');
select is(rls_test.affected($$update public.companies set name = name where id = 'b0000000-0000-0000-0000-000000000001'$$),
  1, 'platform_admin consegue atualizar (ex.: suspender) uma loja');

-- Sem regressão para usuários de loja
:as_admin_a
select is(rls_test.visible('select 1 from public.companies'), 1, 'admin A continua vendo só a própria loja');
:as_seller_b
select is(rls_test.visible('select 1 from public.companies'), 1, 'vendedor B continua vendo só a própria loja');

select * from finish();
rollback;
