-- Legacy permissive policy fixes intentionally omitted; final policies are installed later.

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
