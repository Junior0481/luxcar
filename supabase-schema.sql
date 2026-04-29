-- Sistema de Gerenciamento de Concessionária
-- Execute este SQL no SQL Editor do Supabase

-- =====================================================
-- 1. TABELA DE PERFIS DE USUÁRIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('vendedor', 'administrador')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TABELA DE VEÍCULOS
-- =====================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
-- 3. TABELA DE CUSTOS E MANUTENÇÕES
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
-- 4. TABELA DE NEGOCIAÇÕES
-- =====================================================
CREATE TABLE IF NOT EXISTS negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
-- 5. TABELA DE HISTÓRICO DE INTERAÇÕES
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
-- 6. TABELA DE VENDAS FINALIZADAS
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID REFERENCES negotiations(id) NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
  seller_id UUID REFERENCES profiles(id) NOT NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  payment_method TEXT,
  commission DECIMAL(10, 2),
  sale_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiations_vehicle ON negotiations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_seller ON negotiations(seller_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_stage ON negotiations(stage);
CREATE INDEX IF NOT EXISTS idx_interaction_history_negotiation ON interaction_history(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);

-- =====================================================
-- 8. TRIGGERS PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negotiations_updated_at BEFORE UPDATE ON negotiations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policies para PROFILES
CREATE POLICY "Usuários podem ver todos os perfis" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar próprio perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies para VEHICLES
CREATE POLICY "Todos usuários autenticados podem ver veículos" ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem criar veículos" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem atualizar veículos" ON vehicles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Administradores podem deletar veículos" ON vehicles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrador'
    )
  );

-- Policies para VEHICLE_COSTS
CREATE POLICY "Todos usuários autenticados podem ver custos" ON vehicle_costs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem criar custos" ON vehicle_costs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem atualizar custos" ON vehicle_costs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Administradores podem deletar custos" ON vehicle_costs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'administrador'
    )
  );

-- Policies para NEGOTIATIONS
CREATE POLICY "Todos usuários autenticados podem ver negociações" ON negotiations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem criar negociações" ON negotiations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem atualizar negociações" ON negotiations
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Vendedor pode deletar próprias negociações" ON negotiations
  FOR DELETE USING (seller_id = auth.uid());

-- Policies para INTERACTION_HISTORY
CREATE POLICY "Todos usuários autenticados podem ver histórico" ON interaction_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem criar interações" ON interaction_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policies para SALES
CREATE POLICY "Todos usuários autenticados podem ver vendas" ON sales
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Todos usuários autenticados podem criar vendas" ON sales
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 10. FUNÇÃO PARA CRIAR PERFIL AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil ao registrar usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 11. VIEWS PARA RELATÓRIOS
-- =====================================================

-- View de veículos com informações de negociações ativas
CREATE OR REPLACE VIEW vehicles_with_negotiations AS
SELECT
  v.*,
  COUNT(DISTINCT n.id) FILTER (WHERE n.stage NOT IN ('finalizado', 'perdido')) as active_negotiations_count,
  json_agg(
    json_build_object(
      'id', n.id,
      'seller_name', p.full_name,
      'client_name', n.client_name,
      'stage', n.stage,
      'priority', n.priority
    )
  ) FILTER (WHERE n.id IS NOT NULL AND n.stage NOT IN ('finalizado', 'perdido')) as active_negotiations
FROM vehicles v
LEFT JOIN negotiations n ON v.id = n.vehicle_id
LEFT JOIN profiles p ON n.seller_id = p.id
GROUP BY v.id;

-- View de métricas do dashboard
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM vehicles WHERE status = 'disponivel') as vehicles_available,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'em_negociacao') as vehicles_in_negotiation,
  (SELECT COUNT(*) FROM vehicles WHERE status = 'vendido') as vehicles_sold,
  (SELECT COUNT(*) FROM negotiations WHERE stage NOT IN ('finalizado', 'perdido')) as active_negotiations,
  (SELECT COALESCE(SUM(final_price), 0) FROM sales WHERE EXTRACT(MONTH FROM sale_date) = EXTRACT(MONTH FROM CURRENT_DATE)) as monthly_revenue,
  (SELECT COALESCE(SUM(v.sale_price - v.purchase_price), 0)
   FROM vehicles v
   WHERE v.status = 'disponivel') as potential_profit;
