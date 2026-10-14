BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-branding', 'company-branding', true, 2097152, ARRAY['image/png']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read company branding assets" ON storage.objects;
CREATE POLICY "Public can read company branding assets" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'company-branding');

DROP POLICY IF EXISTS "Company admins upload branding assets" ON storage.objects;
CREATE POLICY "Company admins upload branding assets" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-branding'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND public.is_company_admin(public.current_company_id())
);

DROP POLICY IF EXISTS "Company admins update branding assets" ON storage.objects;
CREATE POLICY "Company admins update branding assets" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-branding'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND public.is_company_admin(public.current_company_id())
)
WITH CHECK (
  bucket_id = 'company-branding'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND public.is_company_admin(public.current_company_id())
);

DROP POLICY IF EXISTS "Company admins delete branding assets" ON storage.objects;
CREATE POLICY "Company admins delete branding assets" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-branding'
  AND (storage.foldername(name))[1] = public.current_company_id()::text
  AND public.is_company_admin(public.current_company_id())
);

COMMIT;
