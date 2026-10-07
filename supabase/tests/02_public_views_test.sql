-- P0-2: a vitrine pública não expõe colunas internas.
begin;
\ir _fixtures.psql
select plan(5);

select hasnt_column('public', 'public_vehicles', 'purchase_price', 'P0-2: public_vehicles sem purchase_price');
select hasnt_column('public', 'public_vehicles', 'plate',          'P0-2: public_vehicles sem plate');
select hasnt_column('public', 'public_vehicles', 'created_by',     'P0-2: public_vehicles sem created_by');

-- Loja inativa não aparece na vitrine.
update public.companies set status = 'inactive' where id = 'b0000000-0000-0000-0000-000000000001';

:as_anon
select is(rls_test.visible('select 1 from public.public_vehicles where company_id = ''b0000000-0000-0000-0000-000000000001'''),
  0, 'P0-2: veículo de loja inativa fora da vitrine');
select is(rls_test.visible('select 1 from public.public_vehicles where company_id = ''a0000000-0000-0000-0000-000000000001'''),
  1, 'vitrine continua mostrando veículo disponível de loja ativa');

select * from finish();
rollback;
