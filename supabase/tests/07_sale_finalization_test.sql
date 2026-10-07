-- P1-2: finalização de venda (UNIQUE em sales, preço acordado, pagamento parcial não finaliza).
begin;
\ir _fixtures.psql
select plan(17);

-- Negociação f101 (loja A, vendedor A): sem proposta, preço acordado = vehicles.sale_price = 50000.
-- Negociação f102 (loja A, vendedor A2): proposta de 45000.
update public.negotiations set offered_price = 45000 where id = 'a0000000-0000-0000-0000-00000000f102';

insert into public.payments (id, company_id, negotiation_id, amount, method, status, created_by) values
  ('a0000000-0000-0000-0000-00000000f401', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 30000, 'pix',           'pending', 'a0000000-0000-0000-0000-0000000000ad'),
  ('a0000000-0000-0000-0000-00000000f402', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 20000, 'financiamento', 'pending', 'a0000000-0000-0000-0000-0000000000ad'),
  ('a0000000-0000-0000-0000-00000000f403', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102', 45000, 'transferencia', 'paid',    'a0000000-0000-0000-0000-0000000000ad');

select is((select count(*)::int from pg_indexes where schemaname = 'public' and indexname = 'ux_sales_negotiation'),
  1, 'P1-2: índice único ux_sales_negotiation existe');

-- Pagamento parcial
:as_admin_a
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000f401', 'paid')$$,
  'admin A marca pagamento parcial como pago');
:as_postgres
select is((select count(*)::int from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'),
  0, 'P1-2: pagamento parcial (30000 de 50000) não cria venda');
select isnt((select stage from public.negotiations where id = 'a0000000-0000-0000-0000-00000000f101'),
  'finalizado', 'P1-2: pagamento parcial não finaliza a negociação');

-- Pagamento que completa o preço
:as_admin_a
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000f402', 'paid')$$,
  'admin A marca o pagamento restante como pago');
:as_postgres
select is((select count(*)::int from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'),
  1, 'P1-2: total pago cobre o preço → exatamente uma venda');
select is((select final_price from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'),
  50000.00::numeric, 'P1-2: final_price = preço acordado, não o valor do último pagamento');
select is((select payment_method from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'),
  'pix', 'forma de pagamento = a de maior valor pago');
select is((select stage from public.negotiations where id = 'a0000000-0000-0000-0000-00000000f101'),
  'finalizado', 'negociação finalizada');
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'),
  'vendido', 'veículo marcado como vendido');
select is((select count(*)::int from public.payments where negotiation_id = 'a0000000-0000-0000-0000-00000000f101' and sale_id is null),
  0, 'pagamentos pagos vinculados à venda');

-- Idempotência e duplicata
:as_admin_a
select is((select (public.finalize_sale('a0000000-0000-0000-0000-00000000f101')).id),
  (select id from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'),
  'P1-2: finalize_sale de novo devolve a mesma venda');
select throws_ok(
  $$insert into public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, sale_date)
    values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 1, current_date)$$,
  '23505', null, 'P1-2: insert direto de 2ª venda (front) é barrado pelo UNIQUE');

-- Preço acordado vindo da proposta
select is((select (public.finalize_sale('a0000000-0000-0000-0000-00000000f102')).final_price),
  45000.00::numeric, 'P1-2: final_price = offered_price da negociação');

-- Permissões
:as_seller_a
select throws_ok($$select public.finalize_sale('a0000000-0000-0000-0000-00000000f101')$$,
  '42501', null, 'vendedor não finaliza venda');
:as_admin_a
select throws_ok($$select public.finalize_sale('b0000000-0000-0000-0000-00000000f101')$$,
  '42501', null, 'admin A não finaliza venda da loja B');
:as_anon
select throws_ok($$select public.finalize_sale('a0000000-0000-0000-0000-00000000f101')$$,
  '42501', null, 'anon não executa finalize_sale');

select * from finish();
rollback;
