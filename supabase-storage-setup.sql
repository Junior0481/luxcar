-- =====================================================
-- CONFIGURAÇÃO DO STORAGE PARA FOTOS DE VEÍCULOS
-- Execute este SQL após criar o schema principal
-- =====================================================

-- 1. Criar bucket para armazenar fotos de veículos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de acesso ao bucket vehicles

-- Permitir que todos vejam as imagens (público)
CREATE POLICY "Imagens de veículos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicles');

-- Permitir que usuários autenticados façam upload
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
);

-- Permitir que usuários autenticados atualizem suas próprias imagens
CREATE POLICY "Usuários podem atualizar suas imagens"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'vehicles'
  AND auth.uid() IS NOT NULL
);

-- Permitir que administradores deletem imagens
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
