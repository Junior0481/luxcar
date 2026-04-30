-- =====================================================
-- MODELO FISICO COMPLETO - LUXCAR / AUTOGEST
-- Consolidado a partir de:
--   1. supabase-schema.sql
--   2. supabase-multitenant-migration.sql
--   3. supabase-fixes.sql
--   4. necessidades do frontend atual
-- =====================================================

-- Extensoes uteis
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. TABELA DE EMPRESAS
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cnpj TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
  max_vehicles INTEGER DEFAULT 50,
  max_users INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TABELA DE PERFIS DE USUARIOS INTERNOS
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vendedor', 'administrador')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE CLIENTES EXTERNOS
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TABELA DE VEICULOS
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  version TEXT,
  purchase_price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2) NOT NULL,
  fipe_code TEXT,
  fipe_value DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'em_negociacao', 'vendido')),
  color TEXT,
  plate TEXT,
  mileage INTEGER,
  fuel_type TEXT,
  transmission TEXT,
  description TEXT,
  images TEXT[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. TABELA DE CUSTOS E MANUTENCOES
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicle_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('manutencao', 'estetica', 'mecanica', 'revisao', 'laudo', 'outro')),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  service_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. TABELA DE NEGOCIACOES
-- =====================================================
CREATE TABLE IF NOT EXISTS negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_cpf TEXT,
  stage TEXT NOT NULL DEFAULT 'primeiro_contato' CHECK (stage IN (
    'primeiro_contato',
    'avaliacao',
    'test_drive_agendado',
    'test_drive_realizado',
    'proposta_enviada',
    'negociacao_preco',
    'aprovacao_credito',
    'documentacao',
    'finalizado',
    'perdido'
  )),
  offered_price DECIMAL(10, 2),
  notes TEXT,
  priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. TABELA DE HISTORICO DE INTERACOES
-- =====================================================
CREATE TABLE IF NOT EXISTS interaction_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'ligacao',
    'whatsapp',
    'email',
    'visita',
    'test_drive',
    'proposta',
    'observacao',
    'outro'
  )),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. TABELA DE VENDAS
-- Ajustada para refletir o frontend atual
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  buyer_cpf TEXT,
  final_price DECIMAL(10, 2) NOT NULL,
  payment_method TEXT,
  commission DECIMAL(10, 2),
  notes TEXT,
  sale_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. TABELA DE LEADS
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. TABELA DE VEICULOS NA TROCA
-- =====================================================
CREATE TABLE IF NOT EXISTS trade_in_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  version TEXT,
  plate TEXT,
  mileage INTEGER,
  color TEXT,
  fuel_type TEXT,
  transmission TEXT,
  condition_notes TEXT,
  evaluated_value DECIMAL(10, 2),
  offered_value DECIMAL(10, 2),
  evaluator_name TEXT,
  evaluation_date DATE,
  images TEXT[],
  needs_evaluation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. INDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_negotiations_company ON negotiations(company_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_vehicle ON negotiations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_seller ON negotiations(seller_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_stage ON negotiations(stage);

CREATE INDEX IF NOT EXISTS idx_interaction_history_negotiation ON interaction_history(negotiation_id);

CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

CREATE INDEX IF NOT EXISTS idx_trade_in_negotiation ON trade_in_vehicles(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_trade_in_company ON trade_in_vehicles(company_id);

-- =====================================================
-- 12. FUNCAO PADRAO PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. TRIGGERS DE UPDATED_AT
-- =====================================================
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_negotiations_updated_at ON negotiations;
CREATE TRIGGER update_negotiations_updated_at
BEFORE UPDATE ON negotiations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trade_in_vehicles_updated_at ON trade_in_vehicles;
CREATE TRIGGER update_trade_in_vehicles_updated_at
BEFORE UPDATE ON trade_in_vehicles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 14. FUNCOES DE CRIACAO AUTOMATICA DE PERFIS
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- O trigger abaixo deve ser habilitado apenas se o fluxo de clientes
-- compartilhar a mesma tabela auth.users e a aplicacao diferenciar tipos
-- de usuario via metadados.
-- DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
-- CREATE TRIGGER on_auth_customer_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW
-- WHEN ((NEW.raw_user_meta_data->>'user_type') = 'customer')
-- EXECUTE FUNCTION public.handle_new_customer();

-- =====================================================
-- 15. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_vehicles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 16. POLICIES - PROFILES
-- =====================================================
DROP POLICY IF EXISTS "Usuarios podem ver todos os perfis" ON profiles;
CREATE POLICY "Usuarios podem ver todos os perfis"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Usuarios podem atualizar proprio perfil" ON profiles;
CREATE POLICY "Usuarios podem atualizar proprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- =====================================================
-- 17. POLICIES - COMPANIES
-- =====================================================
DROP POLICY IF EXISTS "Usuarios veem apenas sua propria empresa" ON companies;
CREATE POLICY "Usuarios veem apenas sua propria empresa"
ON companies FOR SELECT
USING (
  id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Apenas admins atualizam empresa" ON companies;
CREATE POLICY "Apenas admins atualizam empresa"
ON companies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'administrador'
      AND company_id = companies.id
  )
);

-- =====================================================
-- 18. POLICIES - CUSTOMERS
-- =====================================================
DROP POLICY IF EXISTS "Clientes podem ver proprio perfil" ON customers;
CREATE POLICY "Clientes podem ver proprio perfil"
ON customers FOR SELECT
USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Qualquer um pode criar perfil de cliente" ON customers;
CREATE POLICY "Qualquer um pode criar perfil de cliente"
ON customers FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Clientes podem atualizar proprio perfil" ON customers;
CREATE POLICY "Clientes podem atualizar proprio perfil"
ON customers FOR UPDATE
USING (user_id = auth.uid());

-- =====================================================
-- 19. POLICIES - VEHICLES
-- =====================================================
DROP POLICY IF EXISTS "Publico pode ver veiculos disponiveis" ON vehicles;
CREATE POLICY "Publico pode ver veiculos disponiveis"
ON vehicles FOR SELECT
USING (status = 'disponivel' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Usuarios podem ver veiculos da propria empresa" ON vehicles;
CREATE POLICY "Usuarios podem ver veiculos da propria empresa"
ON vehicles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuarios podem criar veiculos para sua empresa" ON vehicles;
CREATE POLICY "Usuarios podem criar veiculos para sua empresa"
ON vehicles FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Administradores podem atualizar veiculos da empresa" ON vehicles;
CREATE POLICY "Administradores podem atualizar veiculos da empresa"
ON vehicles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'administrador'
      AND company_id = vehicles.company_id
  )
);

DROP POLICY IF EXISTS "Administradores podem deletar veiculos da empresa" ON vehicles;
CREATE POLICY "Administradores podem deletar veiculos da empresa"
ON vehicles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'administrador'
      AND company_id = vehicles.company_id
  )
);

-- =====================================================
-- 20. POLICIES - VEHICLE_COSTS
-- =====================================================
DROP POLICY IF EXISTS "Todos usuarios autenticados podem ver custos" ON vehicle_costs;
CREATE POLICY "Todos usuarios autenticados podem ver custos"
ON vehicle_costs FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Todos usuarios autenticados podem criar custos" ON vehicle_costs;
CREATE POLICY "Todos usuarios autenticados podem criar custos"
ON vehicle_costs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Todos usuarios autenticados podem atualizar custos" ON vehicle_costs;
CREATE POLICY "Todos usuarios autenticados podem atualizar custos"
ON vehicle_costs FOR UPDATE
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Administradores podem deletar custos" ON vehicle_costs;
CREATE POLICY "Administradores podem deletar custos"
ON vehicle_costs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'administrador'
  )
);

-- =====================================================
-- 21. POLICIES - NEGOTIATIONS
-- Consolidadas com os fixes mais recentes
-- =====================================================
DROP POLICY IF EXISTS "Usuarios veem negociacoes da propria empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuarios criam negociacoes para sua empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuarios atualizam negociacoes da empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir negociacoes" ON negotiations;
DROP POLICY IF EXISTS "Usuarios podem ver negociacoes da propria empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuarios podem atualizar negociacoes da propria empresa" ON negotiations;

CREATE POLICY "Usuarios autenticados podem inserir negociacoes"
ON negotiations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios podem ver negociacoes da propria empresa"
ON negotiations FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
    OR company_id IS NULL
  )
);

CREATE POLICY "Usuarios podem atualizar negociacoes da propria empresa"
ON negotiations FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Vendedor pode deletar proprias negociacoes" ON negotiations;
CREATE POLICY "Vendedor pode deletar proprias negociacoes"
ON negotiations FOR DELETE
USING (seller_id = auth.uid());

-- =====================================================
-- 22. POLICIES - INTERACTION_HISTORY
-- =====================================================
DROP POLICY IF EXISTS "Todos usuarios autenticados podem ver historico" ON interaction_history;
CREATE POLICY "Todos usuarios autenticados podem ver historico"
ON interaction_history FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Todos usuarios autenticados podem criar interacoes" ON interaction_history;
CREATE POLICY "Todos usuarios autenticados podem criar interacoes"
ON interaction_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 23. POLICIES - SALES
-- =====================================================
DROP POLICY IF EXISTS "Todos usuarios autenticados podem ver vendas" ON sales;
CREATE POLICY "Todos usuarios autenticados podem ver vendas"
ON sales FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Todos usuarios autenticados podem criar vendas" ON sales;
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir vendas" ON sales;
CREATE POLICY "Usuarios autenticados podem inserir vendas"
ON sales FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 24. POLICIES - LEADS
-- =====================================================
DROP POLICY IF EXISTS "Publico pode criar leads" ON leads;
CREATE POLICY "Publico pode criar leads"
ON leads FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios veem leads da propria empresa" ON leads;
CREATE POLICY "Usuarios veem leads da propria empresa"
ON leads FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuarios atualizam leads da empresa" ON leads;
CREATE POLICY "Usuarios atualizam leads da empresa"
ON leads FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- =====================================================
-- 25. POLICIES - TRADE_IN_VEHICLES
-- =====================================================
DROP POLICY IF EXISTS "Usuarios veem veiculos de troca da empresa" ON trade_in_vehicles;
CREATE POLICY "Usuarios veem veiculos de troca da empresa"
ON trade_in_vehicles FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuarios criam veiculos de troca para empresa" ON trade_in_vehicles;
CREATE POLICY "Usuarios criam veiculos de troca para empresa"
ON trade_in_vehicles FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuarios atualizam veiculos de troca da empresa" ON trade_in_vehicles;
CREATE POLICY "Usuarios atualizam veiculos de troca da empresa"
ON trade_in_vehicles FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- =====================================================
-- 26. VIEWS
-- =====================================================
CREATE OR REPLACE VIEW vehicles_with_negotiations AS
SELECT
  v.*,
  COUNT(DISTINCT n.id) FILTER (WHERE n.stage NOT IN ('finalizado', 'perdido')) AS active_negotiations_count,
  json_agg(
    json_build_object(
      'id', n.id,
      'seller_name', p.full_name,
      'client_name', n.client_name,
      'stage', n.stage,
      'priority', n.priority
    )
  ) FILTER (
    WHERE n.id IS NOT NULL
      AND n.stage NOT IN ('finalizado', 'perdido')
  ) AS active_negotiations
FROM vehicles v
LEFT JOIN negotiations n ON v.id = n.vehicle_id
LEFT JOIN profiles p ON n.seller_id = p.id
GROUP BY v.id;

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM vehicles WHERE status = 'disponivel') AS vehicles_available,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'em_negociacao') AS vehicles_in_negotiation,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'vendido') AS vehicles_sold,
  (SELECT COUNT(*) FROM negotiations WHERE stage NOT IN ('finalizado', 'perdido')) AS active_negotiations,
  (
    SELECT COALESCE(SUM(final_price), 0)
    FROM sales
    WHERE EXTRACT(MONTH FROM sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM sale_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  ) AS monthly_revenue,
  (
    SELECT COALESCE(SUM(v.sale_price - v.purchase_price), 0)
    FROM vehicles v
    WHERE v.status = 'disponivel'
  ) AS potential_profit;

CREATE OR REPLACE VIEW public_vehicles AS
SELECT
  v.*,
  c.name AS company_name,
  c.slug AS company_slug,
  c.city AS company_city,
  c.state AS company_state,
  c.phone AS company_phone
FROM vehicles v
LEFT JOIN companies c ON v.company_id = c.id
WHERE v.status = 'disponivel';

GRANT SELECT ON public_vehicles TO anon, authenticated;

-- =====================================================
-- 27. STORAGE - BUCKET DE IMAGENS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Imagens de veiculos sao publicas" ON storage.objects;
CREATE POLICY "Imagens de veiculos sao publicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicles');

DROP POLICY IF EXISTS "Usuarios autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Usuarios autenticados podem fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Usuarios podem atualizar suas imagens" ON storage.objects;
CREATE POLICY "Usuarios podem atualizar suas imagens"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Administradores podem deletar imagens" ON storage.objects;
CREATE POLICY "Administradores podem deletar imagens"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicles'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'administrador'
  )
);

-- =====================================================
-- 28. EMPRESA PADRAO DE EXEMPLO
-- =====================================================
INSERT INTO companies (id, name, slug, email, phone, city, state)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'LuxCar Motors',
  'luxcar',
  'contato@luxcar.com.br',
  '(11) 98765-4321',
  'Sao Paulo',
  'SP'
)
ON CONFLICT (id) DO NOTHING;
