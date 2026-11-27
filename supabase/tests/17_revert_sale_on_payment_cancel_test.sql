-- Cancelar/estornar o pagamento que fechou a venda volta tudo ao estado anterior.
begin;
\ir _fixtures.psql
select plan(9);

-- f101: preço acordado = 50000 (sale_price do veículo). Negociação em "Documentação".
update public.negotiations set stage = 'documentacao' where id = 'a0000000-0000-0000-0000-00000000f101';
insert into public.payments (id, company_id, negotiation_id, amount, method, status, created_by) values
  ('a0000000-0000-0000-0000-00000000f501', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 30000, 'pix', 'pending', 'a0000000-0000-0000-0000-0000000000ad'),
  ('a0000000-0000-0000-0000-00000000f502', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 20000, 'pix', 'pending', 'a0000000-0000-0000-0000-0000000000ad');

:as_admin_a
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000f501', 'paid')$$, 'primeiro pagamento pago');
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000f502', 'paid')$$, 'segundo pagamento fecha a venda');
:as_postgres
select is((select count(*)::int from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'), 1, 'venda criada');
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'), 'vendido', 'veículo vendido');

-- Estorno de um pagamento pago: o total deixa de cobrir o preço.
:as_admin_a
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000f502', 'refunded')$$, 'admin estorna o pagamento');
:as_postgres
select is((select count(*)::int from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'), 0,
  'venda desfeita e fora dos números');
select is((select stage from public.negotiations where id = 'a0000000-0000-0000-0000-00000000f101'), 'documentacao',
  'negociação volta à etapa anterior à venda');
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'), 'em_negociacao',
  'veículo volta para em negociação');
select is((select status from public.payments where id = 'a0000000-0000-0000-0000-00000000f502'), 'refunded',
  'pagamento continua listado, marcado como estornado');

select * from finish();
rollback;
