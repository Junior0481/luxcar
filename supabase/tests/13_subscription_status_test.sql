-- Assinatura automática: status calculado pelas datas, 7 dias de tolerância e bloqueio no banco.
begin;
\ir _fixtures.psql
select plan(11);

:as_postgres
-- Loja A venceu há 1 dia: em atraso, mas ainda acessa.
update public.companies set current_period_end = now() - interval '1 day' where id = 'a0000000-0000-0000-0000-000000000001';
select is((select subscription_status from public.companies where id = 'a0000000-0000-0000-0000-000000000001'), 'past_due',
  'vencida há 1 dia fica em atraso');
select is((select grace_ends_at from public.companies where id = 'a0000000-0000-0000-0000-000000000001'),
  (select current_period_end + interval '7 days' from public.companies where id = 'a0000000-0000-0000-0000-000000000001'),
  'tolerância termina 7 dias após o vencimento');
:as_seller_a
select is(rls_test.visible('select 1 from public.vehicles'), 1, 'loja em atraso continua vendo o estoque');

-- Status manual é ignorado: o trigger recalcula pelas datas.
:as_postgres
update public.companies set subscription_status = 'active' where id = 'a0000000-0000-0000-0000-000000000001';
select is((select subscription_status from public.companies where id = 'a0000000-0000-0000-0000-000000000001'), 'past_due',
  'status não é editável à mão');

-- Loja B venceu há 8 dias: o job diário bloqueia e audita.
set local session_replication_role = replica;
update public.companies set current_period_end = now() - interval '8 days', subscription_status = 'active'
where id = 'b0000000-0000-0000-0000-000000000001';
set local session_replication_role = origin;
select is(public.refresh_subscription_statuses(), 1, 'job diário muda apenas a loja vencida há 8 dias');
select is((select subscription_status from public.companies where id = 'b0000000-0000-0000-0000-000000000001'), 'blocked',
  'vencida há 8 dias fica bloqueada');
select is((select details->>'to' from public.platform_admin_audit
  where company_id = 'b0000000-0000-0000-0000-000000000001' and event_type = 'subscription_status_auto_changed'), 'blocked',
  'mudança automática registrada na auditoria');

:as_seller_b
select is(rls_test.visible('select 1 from public.vehicles'), 0, 'loja bloqueada não lê dados da empresa');
select is((select subscription_status from public.current_company_subscription()), 'blocked',
  'lojista bloqueado consegue saber que está bloqueado');

-- Pagamento: novo vencimento reativa na hora.
:as_postgres
update public.companies set current_period_end = (current_period_end + interval '1 month')
where id = 'b0000000-0000-0000-0000-000000000001';
select is((select subscription_status from public.companies where id = 'b0000000-0000-0000-0000-000000000001'), 'active',
  'pagamento com novo vencimento volta para ativa');
:as_seller_b
select isnt(rls_test.visible('select 1 from public.vehicles'), 0, 'loja reativada volta a acessar');

select * from finish();
rollback;
