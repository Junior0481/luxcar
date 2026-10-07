-- Legacy permissive policy fixes intentionally omitted; final policies are installed later.

-- Concede acesso à view segura definida na migration white-label.
GRANT SELECT ON public_vehicles TO anon, authenticated;
