-- Regras de negócio no banco: venda única por veículo, etapas presas à venda, pagamentos e
-- vendas só pelas funções, troca abatendo o valor, limite do plano, vitrine e relatório.
begin;
\ir _fixtures.psql
select plan(32);

-- Fixtures: f101 (vendedor A) e f102 (vendedor A2) disputam o veículo f001 (R$ 50.000).
-- f002 é um segundo veículo da loja A, sem negociação.
set local session_replication_role = replica;
insert into public.vehicles (id, company_id, brand, model, year, purchase_price, sale_price, plate, status) values
  ('a0000000-0000-0000-0000-00000000f002', 'a0000000-0000-0000-0000-000000000001', 'VW', 'Polo', 2021, 50000, 60000, 'AAA1A12', 'disponivel');
insert into public.vehicle_costs (vehicle_id, cost_type, description, amount) values
  ('a0000000-0000-0000-0000-00000000f001', 'laudo', 'Laudo cautelar', 500);
set local session_replication_role = origin;

-- 1. Pagamento pela API nasce pendente; troca do vendedor nasce sem avaliação.
:as_seller_a
insert into public.payments (id, company_id, negotiation_id, amount, method, status, paid_at, created_by) values
  ('a0000000-0000-0000-0000-00000000e501', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101',
   30000, 'pix', 'paid', now(), 'a0000000-0000-0000-0000-0000000000a1');
insert into public.trade_in_vehicles (id, negotiation_id, company_id, brand, model, year, offered_value, evaluated_value, evaluator_name, needs_evaluation) values
  ('a0000000-0000-0000-0000-00000000e601', 'a0000000-0000-0000-0000-00000000f101', 'a0000000-0000-0000-0000-000000000001',
   'Fiat', 'Palio', 2012, 10000, 90000, 'Eu mesmo', false);
:as_postgres
select is((select status from public.payments where id = 'a0000000-0000-0000-0000-00000000e501'), 'pending',
  'pagamento criado como pago pela API fica pendente');
select is((select needs_evaluation::text || coalesce(evaluated_value::text, '-') from public.trade_in_vehicles where id = 'a0000000-0000-0000-0000-00000000e601'),
  'true-', 'vendedor não avalia a própria troca');

-- 2. Etapas: "finalizado" só com venda; veículo da negociação não muda.
:as_seller_a
select throws_ok($$update public.negotiations set stage = 'finalizado' where id = 'a0000000-0000-0000-0000-00000000f101'$$,
  'P0001', null, 'vendedor não marca finalizado sem venda');
select throws_ok($$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name, stage) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f002', 'a0000000-0000-0000-0000-0000000000a1', 'X', 'finalizado')$$,
  'P0001', null, 'negociação não nasce finalizada');
select throws_ok($$update public.negotiations set vehicle_id = 'a0000000-0000-0000-0000-00000000f002' where id = 'a0000000-0000-0000-0000-00000000f101'$$,
  'P0001', null, 'veículo da negociação não é trocado');

-- 3. Valor acima do saldo é recusado.
select throws_ok($$insert into public.payments (company_id, negotiation_id, amount, method, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 20001, 'pix', 'a0000000-0000-0000-0000-0000000000a1')$$,
  'P0001', null, 'pagamento acima do valor a pagar é recusado');

-- 4. Troca aprovada pelo administrador abate o valor a pagar (50.000 - 10.000 = 40.000).
:as_admin_a
update public.trade_in_vehicles set needs_evaluation = false, evaluated_value = 12000 where id = 'a0000000-0000-0000-0000-00000000e601';
insert into public.payments (id, company_id, negotiation_id, amount, method, created_by) values
  ('a0000000-0000-0000-0000-00000000e502', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101',
   10000, 'dinheiro', 'a0000000-0000-0000-0000-0000000000ad');
select throws_ok($$insert into public.payments (company_id, negotiation_id, amount, method, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f101', 1, 'pix', 'a0000000-0000-0000-0000-0000000000ad')$$,
  'P0001', null, 'troca aprovada reduz o saldo: 40.000 já registrados');
insert into public.payments (id, company_id, negotiation_id, amount, method, created_by) values
  ('a0000000-0000-0000-0000-00000000e503', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102',
   5000, 'pix', 'a0000000-0000-0000-0000-0000000000ad');

-- 5. Escrita direta em pagamentos e vendas é barrada mesmo para o administrador.
select is(rls_test.affected($$update public.payments set status = 'paid' where id = 'a0000000-0000-0000-0000-00000000e501'$$),
  0, 'admin não confirma pagamento por UPDATE direto');
select throws_ok($$insert into public.sales (company_id, negotiation_id, vehicle_id, seller_id, final_price, sale_date) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a2', 1, '2020-01-01')$$,
  '42501', null, 'admin não cria venda por INSERT direto');

-- 6. Valor proposto fica fixo depois do primeiro pagamento confirmado.
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000e502', 'paid')$$, 'primeiro pagamento confirmado');
:as_seller_a
select throws_ok($$update public.negotiations set offered_price = 1 where id = 'a0000000-0000-0000-0000-00000000f101'$$,
  'P0001', null, 'valor proposto não muda depois de pagamento confirmado');
select throws_ok($$update public.negotiations set stage = 'perdido' where id = 'a0000000-0000-0000-0000-00000000f101'$$,
  'P0001', null, 'negociação com pagamento confirmado não vira perdida');

-- 7. Venda fechada: valor a pagar considera a troca; o preço da venda é o cheio.
:as_admin_a
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000e501', 'paid')$$, 'segundo pagamento fecha a venda');
:as_postgres
select is((select final_price from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'), 50000.00::numeric,
  'venda pelo preço cheio, com 40.000 pagos e 10.000 em troca');
select is((select sale_date from public.sales where negotiation_id = 'a0000000-0000-0000-0000-00000000f101'), public.local_today(),
  'data da venda no fuso de São Paulo');

-- 8. Venda fechada não muda de etapa nem de troca.
:as_seller_a
select throws_ok($$update public.negotiations set stage = 'primeiro_contato' where id = 'a0000000-0000-0000-0000-00000000f101'$$,
  'P0001', null, 'vendedor não reabre negociação vendida');
:as_admin_a
select throws_ok($$update public.trade_in_vehicles set offered_value = 1 where id = 'a0000000-0000-0000-0000-00000000e601'$$,
  'P0001', null, 'troca não muda depois da venda');

-- 9. Veículo vendido não é vendido de novo.
select throws_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000e503', 'paid')$$,
  'P0001', null, 'pagamento de outra negociação do veículo vendido não é confirmado');
select throws_ok($$select public.finalize_sale('a0000000-0000-0000-0000-00000000f102')$$,
  'P0001', null, 'segunda venda do mesmo veículo é recusada');
:as_seller_a2
select throws_ok($$insert into public.payments (company_id, negotiation_id, amount, method, created_by) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f102', 100, 'pix', 'a0000000-0000-0000-0000-0000000000a2')$$,
  'P0001', null, 'veículo vendido não recebe pagamento em outra negociação');
:as_seller_a
select throws_ok($$insert into public.negotiations (company_id, vehicle_id, seller_id, client_name) values
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f001', 'a0000000-0000-0000-0000-0000000000a1', 'Outro cliente')$$,
  'P0001', null, 'veículo vendido não abre negociação');

-- 10. Perdida não reabre com o veículo vendido.
:as_postgres
update public.payments set status = 'cancelled' where id = 'a0000000-0000-0000-0000-00000000e503';
:as_seller_a2
update public.negotiations set stage = 'perdido' where id = 'a0000000-0000-0000-0000-00000000f102';
select throws_ok($$update public.negotiations set stage = 'primeiro_contato' where id = 'a0000000-0000-0000-0000-00000000f102'$$,
  'P0001', null, 'negociação perdida não reabre em veículo vendido');

-- 11. Excluir a única negociação devolve o veículo à vitrine.
:as_seller_a
insert into public.negotiations (id, company_id, vehicle_id, seller_id, client_name) values
  ('a0000000-0000-0000-0000-00000000e701', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000f002', 'a0000000-0000-0000-0000-0000000000a1', 'Cliente Polo');
:as_postgres
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f002'), 'em_negociacao', 'negociação aberta reserva o veículo');
:as_seller_a
delete from public.negotiations where id = 'a0000000-0000-0000-0000-00000000e701';
:as_postgres
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f002'), 'disponivel', 'excluir a negociação libera o veículo');

-- 12. Limite do plano conta o estoque, não os vendidos (f001 vendido, f002 em estoque).
update public.plans set max_vehicles = 2 where id = 'silver';
:as_admin_a
select lives_ok($$insert into public.vehicles (company_id, brand, model, year, purchase_price, sale_price) values
  ('a0000000-0000-0000-0000-000000000001', 'Fiat', 'Argo', 2022, 60000, 70000)$$, 'vendido não ocupa vaga do plano');
select throws_ok($$insert into public.vehicles (company_id, brand, model, year, purchase_price, sale_price) values
  ('a0000000-0000-0000-0000-000000000001', 'Fiat', 'Mobi', 2022, 50000, 55000)$$, '23514', null, 'estoque cheio continua barrado');

-- 13. Relatório: negociação de hoje aparece no filtro de hoje; custo do veículo vem junto.
:as_postgres
update public.companies set plan = 'gold' where id = 'a0000000-0000-0000-0000-000000000001';
:as_admin_a
select is(jsonb_array_length(public.report_data(public.local_today()::text, public.local_today()::text)->'negotiations'), 2,
  'negociações criadas hoje entram no relatório de hoje');
select is((public.report_data(public.local_today()::text, public.local_today()::text)->'sales'->0->>'costs_total')::numeric, 500::numeric,
  'relatório traz o custo do veículo vendido');

-- 14. Estorno desfaz a venda e o veículo volta à negociação.
select lives_ok($$select public.set_payment_status('a0000000-0000-0000-0000-00000000e501', 'refunded')$$, 'estorno do pagamento');
:as_postgres
select is((select count(*)::int from public.sales where vehicle_id = 'a0000000-0000-0000-0000-00000000f001'), 0, 'estorno desfaz a venda');

-- 15. Loja bloqueada sai da vitrine pública.
update public.companies set current_period_end = now() - interval '30 days' where id = 'a0000000-0000-0000-0000-000000000001';
:as_anon
select is(rls_test.visible($$select 1 from public.public_company_branding where id = 'a0000000-0000-0000-0000-000000000001'$$), 0,
  'loja bloqueada some da vitrine');
select is(rls_test.visible($$select 1 from public.public_vehicles where company_id = 'a0000000-0000-0000-0000-000000000001'$$), 0,
  'veículos da loja bloqueada somem da vitrine');

select * from finish();
rollback;
