-- Guard de profiles (0900): usuário não muda o próprio papel/tenant; migrations (postgres) seguem funcionando.
begin;
\ir _fixtures.psql
select plan(5);

:as_seller_a
select throws_ok(
  $$update public.profiles set role = 'administrador' where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  null, null, 'vendedor A não se promove a administrador');
select throws_ok(
  $$update public.profiles set company_id = 'b0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  null, null, 'vendedor A não muda de loja');
select lives_ok(
  $$update public.profiles set full_name = 'Novo Nome' where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  'vendedor A edita o próprio nome');

:as_seller_b
select is((with u as (update public.profiles set full_name = 'hack' where id = 'a0000000-0000-0000-0000-0000000000a1' returning 1) select count(*)::int from u),
  0, 'vendedor B não edita perfil de outro usuário');

-- Contexto de migration/SQL editor: postgres sem JWT precisa conseguir corrigir dados (P1-3).
:as_postgres
select lives_ok(
  $$update public.profiles set company_id = 'b0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-0000000000a2'$$,
  'P1-3: postgres (migration) consegue alterar company_id');

select * from finish();
rollback;
