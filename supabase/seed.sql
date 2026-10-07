-- Seed de DEMO para o preview local. NUNCA aplicar em produção.
-- Senha de todos os usuários: Demo@12345

set session_replication_role = replica; -- não dispara handle_new_user/guard; perfis criados abaixo

insert into public.companies (id, name, slug, email, phone, city, state, status) values
  ('00000000-0000-0000-0000-000000000001', 'LuxCar Motors', 'luxcar',      'contato@luxcar.demo',      '(11) 4000-1000', 'São Paulo',      'SP', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Auto Premium',  'autopremium', 'contato@autopremium.demo', '(31) 4000-2000', 'Belo Horizonte', 'MG', 'active')
on conflict (id) do update set name = excluded.name, slug = excluded.slug, status = 'active';

with u(id, email, full_name) as (values
  ('d0000000-0000-0000-0000-000000000001'::uuid, 'admin@luxcar.demo',         'Ana Admin (LuxCar)'),
  ('d0000000-0000-0000-0000-000000000002'::uuid, 'vendedor@luxcar.demo',      'Victor Vendedor (LuxCar)'),
  ('d0000000-0000-0000-0000-000000000003'::uuid, 'admin@autopremium.demo',    'Bruna Admin (Auto Premium)'),
  ('d0000000-0000-0000-0000-000000000004'::uuid, 'vendedor@autopremium.demo', 'Bruno Vendedor (Auto Premium)'),
  ('d0000000-0000-0000-0000-000000000005'::uuid, 'plataforma@luxcar.demo',    'Paula Plataforma')
)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now(),
  '', '', '', ''
from u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%.demo'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into public.profiles (id, email, full_name, role, company_id) values
  ('d0000000-0000-0000-0000-000000000001', 'admin@luxcar.demo',         'Ana Admin (LuxCar)',            'administrador',  '00000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'vendedor@luxcar.demo',      'Victor Vendedor (LuxCar)',      'vendedor',       '00000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000003', 'admin@autopremium.demo',    'Bruna Admin (Auto Premium)',    'administrador',  '00000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000004', 'vendedor@autopremium.demo', 'Bruno Vendedor (Auto Premium)', 'vendedor',       '00000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000005', 'plataforma@luxcar.demo',    'Paula Plataforma',              'platform_admin', null)
on conflict (id) do update set role = excluded.role, company_id = excluded.company_id, full_name = excluded.full_name;

insert into public.vehicles (id, company_id, brand, model, year, version, purchase_price, sale_price, status, color, plate, mileage, fuel_type, transmission, description, created_by) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Toyota',     'Corolla', 2022, 'XEi 2.0',     105000, 128900, 'disponivel',    'Prata',  'LUX1A01', 32000, 'flex',     'automatico', 'Único dono, revisões na concessionária.', 'd0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Honda',      'HR-V',    2021, 'EXL 1.5',      98000, 119900, 'em_negociacao', 'Branco', 'LUX1A02', 41000, 'flex',     'automatico', 'Teto solar, couro.',                    'd0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Volkswagen', 'Nivus',   2023, 'Highline',     99000, 121500, 'disponivel',    'Cinza',  'LUX1A03', 15000, 'flex',     'automatico', 'Garantia de fábrica.',                  'd0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Jeep',       'Compass', 2020, 'Limited',     112000, 134000, 'vendido',       'Preto',  'LUX1A04', 58000, 'diesel',   'automatico', 'Diesel 4x4.',                           'd0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Fiat',       'Pulse',   2022, 'Impetus',      78000,  94900, 'disponivel',    'Vermelho','APR2B01', 27000, 'flex',     'automatico', 'Turbo 200.',                            'd0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'Hyundai',    'Creta',   2021, 'Platinum',     95000, 114500, 'em_negociacao', 'Azul',   'APR2B02', 39000, 'flex',     'automatico', 'Multimídia, câmera 360.',               'd0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'Chevrolet',  'Onix',    2023, 'Premier',      70000,  86900, 'disponivel',    'Branco', 'APR2B03',  9000, 'flex',     'automatico', 'Seminovo.',                             'd0000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.negotiations (id, company_id, vehicle_id, seller_id, client_name, client_phone, client_email, stage, offered_price, priority) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Carlos Lima',   '(11) 99999-0001', 'carlos@cliente.demo', 'proposta_enviada', 115000, 'alta'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Marina Souza',  '(11) 99999-0002', 'marina@cliente.demo', 'finalizado',       132000, 'media'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'Rafael Costa',  '(31) 99999-0003', 'rafael@cliente.demo', 'test_drive_agendado', 110000, 'media')
on conflict (id) do nothing;

insert into public.sales (negotiation_id, company_id, vehicle_id, seller_id, final_price, payment_method, sale_date)
select 'f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 132000, 'financiamento', current_date - 5
where not exists (select 1 from public.sales where negotiation_id = 'f0000000-0000-0000-0000-000000000002');

insert into public.leads (company_id, vehicle_id, customer_name, customer_email, customer_phone, message, status, assigned_to) values
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Juliana Alves', 'juliana@cliente.demo', '(11) 98888-0001', 'Aceita troca?',         'new',       'd0000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'Pedro Rocha',   'pedro@cliente.demo',   '(11) 98888-0002', 'Qual o menor preço?',   'contacted', 'd0000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 'Laura Mendes',  'laura@cliente.demo',   '(31) 98888-0003', 'Posso agendar visita?', 'new',       'd0000000-0000-0000-0000-000000000004');

set session_replication_role = origin;
