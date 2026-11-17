-- Planos Silver/Gold/Platinum: limites de veículos, equipe e relatórios valem no banco.
-- As lojas das fixtures entram no plano padrão (Silver: 1 adm, 5 vendedores, 25 carros, sem relatórios).
begin;
\ir _fixtures.psql
select plan(10);

select is((select plan from public.companies where id = 'a0000000-0000-0000-0000-000000000001'), 'silver',
  'empresa nova entra no Silver por padrão');

-- Veículos: loja A já tem 1; completa 25 e tenta o 26º.
set local session_replication_role = replica;
insert into public.vehicles (company_id, brand, model, year, purchase_price, sale_price, status)
select 'a0000000-0000-0000-0000-000000000001', 'VW', 'Gol', 2020, 40000, 50000, 'disponivel'
from generate_series(1, 24);
set local session_replication_role = origin;

:as_admin_a
select throws_ok(
  $$insert into public.vehicles (company_id, brand, model, year, purchase_price, sale_price, status)
    values ('a0000000-0000-0000-0000-000000000001', 'VW', 'Polo', 2021, 50000, 60000, 'disponivel')$$,
  '23514', null, 'Silver não cadastra o 26º veículo (via API direta)');

:as_postgres
select lives_ok(
  $$insert into public.vehicles (company_id, brand, model, year, purchase_price, sale_price, status)
    values ('b0000000-0000-0000-0000-000000000001', 'Fiat', 'Mobi', 2022, 40000, 48000, 'disponivel')$$,
  'loja abaixo do limite continua cadastrando veículos');

-- Vendedores: loja A tem 2; completa 5 e tenta o 6º.
:as_postgres
set local session_replication_role = replica;
insert into auth.users (id, email)
select ('a0000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'extra' || n || '@test.local'
from generate_series(1, 4) n;
insert into public.profiles (id, email, full_name, role, company_id)
select ('a0000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'extra' || n || '@test.local', 'Extra ' || n, 'vendedor', null
from generate_series(1, 4) n;
set local session_replication_role = origin;

update public.profiles set company_id = 'a0000000-0000-0000-0000-000000000001'
where id in ('a0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000103');
select is((select count(*)::int from public.profiles where company_id = 'a0000000-0000-0000-0000-000000000001' and role = 'vendedor'), 5,
  'Silver aceita até 5 vendedores');
select throws_ok(
  $$update public.profiles set company_id = 'a0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000104'$$,
  '23514', null, 'Silver não aceita o 6º vendedor');
select throws_ok(
  $$update public.profiles set company_id = 'a0000000-0000-0000-0000-000000000001', role = 'administrador' where id = 'a0000000-0000-0000-0000-000000000104'$$,
  '23514', null, 'Silver não aceita o 2º administrador');

-- Relatórios: Silver recusa o consolidado, mas as telas operacionais seguem lendo negociações.
:as_seller_a
select is(rls_test.visible('select 1 from public.negotiations'), 1,
  'Silver continua lendo as próprias negociações');
:as_admin_a
select throws_ok($$select public.report_data('2000-01-01', '2100-01-01')$$,
  '42501', null, 'Silver não acessa relatórios');

:as_postgres
update public.companies set plan = 'gold' where id = 'b0000000-0000-0000-0000-000000000001';
:as_seller_b
select lives_ok($$select public.report_data('2000-01-01', '2100-01-01')$$, 'Gold acessa relatórios');

-- O lojista não troca o próprio plano.
:as_admin_a
select throws_ok(
  $$update public.companies set plan = 'platinum' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'administrador da loja não altera o plano');

select * from finish();
rollback;
