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

-- Tenant policies are installed in the final hardening migration.

-- =====================================================
-- 7. TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_trade_in_vehicles_updated_at ON trade_in_vehicles;
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
DROP VIEW IF EXISTS public.public_vehicles;
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
