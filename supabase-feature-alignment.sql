-- Execute este arquivo depois do supabase-schema.sql
-- Ele adiciona estruturas que o frontend ja espera usar.

-- =====================================================
-- 1. COLUNAS OPCIONAIS PARA MULTIEMPRESA
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_id UUID;

-- =====================================================
-- 2. TABELA DE EMPRESAS
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  logo_url TEXT,
  primary_color TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'enterprise')),
  max_vehicles INTEGER DEFAULT 50,
  max_users INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TABELA DE LEADS
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. VEICULOS NA TROCA
-- =====================================================
CREATE TABLE IF NOT EXISTS trade_in_vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
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
  needs_evaluation BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. FOREIGN KEYS OPCIONAIS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_company_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_company_id_fkey'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT vehicles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'negotiations_company_id_fkey'
  ) THEN
    ALTER TABLE negotiations
      ADD CONSTRAINT negotiations_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_company_id_fkey'
  ) THEN
    ALTER TABLE sales
      ADD CONSTRAINT sales_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 7. VIEW PUBLICA DE VEICULOS
-- =====================================================
CREATE OR REPLACE VIEW public_vehicles AS
SELECT
  v.*,
  c.name AS company_name,
  c.slug AS company_slug,
  c.city AS company_city,
  c.state AS company_state,
  c.phone AS company_phone
FROM vehicles v
LEFT JOIN companies c ON c.id = v.company_id
WHERE v.status = 'disponivel';

-- =====================================================
-- 8. UPDATED_AT
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
-- 9. INDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_company_id ON negotiations(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_id ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_trade_in_negotiation_id ON trade_in_vehicles(negotiation_id);

-- =====================================================
-- 10. RLS
-- =====================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'companies' AND policyname = 'Todos podem ver empresas'
  ) THEN
    CREATE POLICY "Todos podem ver empresas" ON companies
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'Usuarios autenticados podem ver clientes'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem ver clientes" ON customers
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'Usuarios autenticados podem criar clientes'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem criar clientes" ON customers
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'Qualquer pessoa pode criar leads'
  ) THEN
    CREATE POLICY "Qualquer pessoa pode criar leads" ON leads
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leads' AND policyname = 'Usuarios autenticados podem ver leads'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem ver leads" ON leads
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trade_in_vehicles' AND policyname = 'Usuarios autenticados podem ver veiculos na troca'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem ver veiculos na troca" ON trade_in_vehicles
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trade_in_vehicles' AND policyname = 'Usuarios autenticados podem criar veiculos na troca'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem criar veiculos na troca" ON trade_in_vehicles
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trade_in_vehicles' AND policyname = 'Usuarios autenticados podem atualizar veiculos na troca'
  ) THEN
    CREATE POLICY "Usuarios autenticados podem atualizar veiculos na troca" ON trade_in_vehicles
      FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
