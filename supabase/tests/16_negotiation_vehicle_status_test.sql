-- Vendedor muda o estágio da própria negociação e o veículo acompanha, sem editar o veículo.
begin;
\ir _fixtures.psql
select plan(5);

:as_seller_a
select is(rls_test.affected($$update public.negotiations set stage = 'proposta_enviada' where id = 'a0000000-0000-0000-0000-00000000f101'$$),
  1, 'vendedor muda o estágio da própria negociação');
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'), 'em_negociacao',
  'veículo passa a em negociação');
select is(rls_test.affected($$update public.vehicles set sale_price = 1 where id = 'a0000000-0000-0000-0000-00000000f001'$$),
  0, 'vendedor continua sem editar o veículo');

-- Uma negociação perdida não libera o veículo enquanto a do colega segue aberta.
update public.negotiations set stage = 'perdido' where id = 'a0000000-0000-0000-0000-00000000f101';
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'), 'em_negociacao',
  'outra negociação aberta mantém o veículo em negociação');

:as_seller_a2
update public.negotiations set stage = 'perdido' where id = 'a0000000-0000-0000-0000-00000000f102';
select is((select status from public.vehicles where id = 'a0000000-0000-0000-0000-00000000f001'), 'disponivel',
  'última negociação perdida devolve o veículo para disponível');

select * from finish();
rollback;
