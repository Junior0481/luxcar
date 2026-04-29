-- Correção das políticas RLS para negociações
-- Remove políticas antigas que podem estar causando conflito
DROP POLICY IF EXISTS "Usuários podem inserir negociações da própria empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuários podem ver negociações da própria empresa" ON negotiations;
DROP POLICY IF EXISTS "Usuários podem atualizar negociações da própria empresa" ON negotiations;

-- Recria políticas mais permissivas
CREATE POLICY "Usuários autenticados podem inserir negociações"
  ON negotiations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Usuários podem ver negociações da própria empresa"
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

CREATE POLICY "Usuários podem atualizar negociações da própria empresa"
  ON negotiations FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Corrige a política de sales também para evitar problemas similares
DROP POLICY IF EXISTS "Usuários podem inserir vendas da própria empresa" ON sales;

CREATE POLICY "Usuários autenticados podem inserir vendas"
  ON sales FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Garante que a view public_vehicles existe
CREATE OR REPLACE VIEW public_vehicles AS
SELECT
  v.*,
  c.name as company_name,
  c.slug as company_slug,
  c.city as company_city,
  c.state as company_state,
  c.phone as company_phone
FROM vehicles v
LEFT JOIN companies c ON v.company_id = c.id
WHERE v.status = 'disponivel';

-- Permite acesso público à view
GRANT SELECT ON public_vehicles TO anon, authenticated;
