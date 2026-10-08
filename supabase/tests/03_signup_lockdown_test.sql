-- P0-3: cadastro público não escolhe papel nem tenant pelos metadados.
begin;
\ir _fixtures.psql
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-0000000000e1', 'attacker@test.local',
   '{"full_name":"Atacante","role":"administrador","company_id":"a0000000-0000-0000-0000-000000000001"}'),
  ('c0000000-0000-0000-0000-0000000000e2', 'attacker2@test.local',
   '{"full_name":"Atacante 2","role":"platform_admin"}');

select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-0000000000e1'),
  'vendedor', 'P0-3: metadado role=administrador é ignorado');
select is((select company_id from public.profiles where id = 'c0000000-0000-0000-0000-0000000000e1'),
  null, 'P0-3: metadado company_id é ignorado (sem tenant até provisionamento)');
select is((select role from public.profiles where id = 'c0000000-0000-0000-0000-0000000000e2'),
  'vendedor', 'P0-3: metadado role=platform_admin é ignorado');

-- O atacante não enxerga nada da loja A.
reset role;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true); end $$;
set local role authenticated;
select is(rls_test.visible('select 1 from public.negotiations'), 0, 'P0-3: conta recém-criada não lê negociações da loja A');

select * from finish();
rollback;
