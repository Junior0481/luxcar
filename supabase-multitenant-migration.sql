-- =====================================================
-- MIGRAÇÃO PARA SISTEMA MULTI-TENANT (SaaS)
-- Execute APÓS o schema principal
-- =====================================================

-- =====================================================
-- 1. CRIAR TABELA DE LOJAS/EMPRESAS
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL amigável: luxcar, automax, etc
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
-- 2. ADICIONAR COMPANY_ID NAS TABELAS EXISTENTES
-- =====================================================

-- Adicionar company_id em profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);

-- Adicionar company_id em vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);

-- Adicionar company_id em negotiations
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_negotiations_company ON negotiations(company_id);

-- Adicionar company_id em sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);

-- =====================================================
-- 3. CRIAR TABELA DE CLIENTES (PÚBLICO)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. CRIAR TABELA DE LEADS
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
  source TEXT DEFAULT 'website', -- website, whatsapp, phone, etc
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES profiles(id), -- vendedor responsável
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- =====================================================
-- 5. CRIAR TABELA DE VEÍCULOS NA TROCA
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
  evaluated_value DECIMAL(10, 2), -- valor avaliado
  offered_value DECIMAL(10, 2), -- valor oferecido ao cliente
  evaluator_name TEXT, -- nome do avaliador
  evaluation_date DATE,
  images TEXT[],
  needs_evaluation BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_in_negotiation ON trade_in_vehicles(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_trade_in_company ON trade_in_vehicles(company_id);

-- =====================================================
-- 6. ATUALIZAR RLS POLICIES COM FILTRO DE COMPANY
-- =====================================================

-- Remover policies antigas de vehicles
DROP POLICY IF EXISTS "Todos usuários autenticados podem ver veículos" ON vehicles;
DROP POLICY IF EXISTS "Todos usuários autenticados podem criar veículos" ON vehicles;
DROP POLICY IF EXISTS "Todos usuários autenticados podem atualizar veículos" ON vehicles;
DROP POLICY IF EXISTS "Administradores podem deletar veículos" ON vehicles;

-- Novas policies com filtro de company

-- VEHICLES - Público pode ver veículos ativos
CREATE POLICY "Público pode ver veículos disponíveis"
  ON vehicles FOR SELECT
  USING (status = 'disponivel' OR auth.uid() IS NOT NULL);

-- VEHICLES - Usuários da mesma empresa podem ver seus veículos
CREATE POLICY "Usuários podem ver veículos da própria empresa"
  ON vehicles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- VEHICLES - Usuários podem criar veículos para sua empresa
CREATE POLICY "Usuários podem criar veículos para sua empresa"
  ON vehicles FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- VEHICLES - Apenas administradores podem atualizar veículos
CREATE POLICY "Administradores podem atualizar veículos da empresa"
  ON vehicles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'administrador'
      AND company_id = vehicles.company_id
    )
  );

-- VEHICLES - Apenas administradores podem deletar veículos
CREATE POLICY "Administradores podem deletar veículos da empresa"
  ON vehicles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'administrador'
      AND company_id = vehicles.company_id
    )
  );

-- NEGOTIATIONS - Filtrar por empresa
DROP POLICY IF EXISTS "Todos usuários autenticados podem ver negociações" ON negotiations;
DROP POLICY IF EXISTS "Todos usuários autenticados podem criar negociações" ON negotiations;
DROP POLICY IF EXISTS "Todos usuários autenticados podem atualizar negociações" ON negotiations;

CREATE POLICY "Usuários veem negociações da própria empresa"
  ON negotiations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários criam negociações para sua empresa"
  ON negotiations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam negociações da empresa"
  ON negotiations FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- POLICIES para COMPANIES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas sua própria empresa"
  ON companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

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

-- POLICIES para CUSTOMERS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes podem ver próprio perfil"
  ON customers FOR SELECT
  USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "Qualquer um pode criar perfil de cliente"
  ON customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Clientes podem atualizar próprio perfil"
  ON customers FOR UPDATE
  USING (user_id = auth.uid());

-- POLICIES para LEADS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Público pode criar leads"
  ON leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários veem leads da própria empresa"
  ON leads FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam leads da empresa"
  ON leads FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- POLICIES para TRADE_IN_VEHICLES
ALTER TABLE trade_in_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem veículos de troca da empresa"
  ON trade_in_vehicles FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários criam veículos de troca para empresa"
  ON trade_in_vehicles FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuários atualizam veículos de troca da empresa"
  ON trade_in_vehicles FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trade_in_vehicles_updated_at BEFORE UPDATE ON trade_in_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. FUNÇÃO PARA CRIAR PERFIL DE CLIENTE
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, user_id, email, full_name)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Cliente')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. VIEWS ATUALIZADAS
-- =====================================================

-- View de veículos públicos com informações da empresa
CREATE OR REPLACE VIEW public_vehicles AS
SELECT
  v.*,
  c.name as company_name,
  c.slug as company_slug,
  c.city as company_city,
  c.state as company_state,
  c.phone as company_phone
FROM vehicles v
INNER JOIN companies c ON v.company_id = c.id
WHERE v.status = 'disponivel'
AND c.status = 'active';

-- =====================================================
-- 10. INSERIR EMPRESA PADRÃO PARA TESTES
-- =====================================================
-- ATENÇÃO: Remova isso em produção ou altere os dados

INSERT INTO companies (id, name, slug, email, phone, city, state)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'LuxCar Motors',
  'luxcar',
  'contato@luxcar.com.br',
  '(11) 98765-4321',
  'São Paulo',
  'SP'
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- INSTRUÇÕES PARA CRIAR ADMIN INICIAL
-- =====================================================
-- 1. Crie um usuário via interface de registro (será vendedor)
-- 2. Execute este SQL substituindo o email do usuário:

-- UPDATE profiles
-- SET role = 'administrador',
--     company_id = '00000000-0000-0000-0000-000000000001'
-- WHERE email = 'admin@luxcar.com.br';

-- OU via SQL direto:
-- INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
-- VALUES (...); -- Depois ajuste o profile manualmente
