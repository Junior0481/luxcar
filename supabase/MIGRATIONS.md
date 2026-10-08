# Supabase migrations

Aplicar apenas os arquivos numerados, em ordem crescente, com Supabase CLI em ambiente controlado. Não aplique `REFERENCE_MODELO_FISICO_COMPLETO.sql`: ele preserva um modelo alternativo antigo, não uma etapa. Scripts anteriores não estabelecem o estado real do banco; audite/alinhe qualquer banco existente antes da primeira aplicação.

1. `20261007000100_initial_schema.sql` — tabelas centrais, índices, funções, triggers e views iniciais.
2. `20261007000200_multitenant.sql` — companies, vínculo de tenant, clientes, leads, trocas, triggers e view pública; semente fixa de empresa legada.
3. `20261007000300_platform_admin.sql` — papel de plataforma, helpers de autorização e criação de venda.
4. `20261007000400_white_label.sql` — branding, pagamentos, preferências, funções de tenant, policies (incluindo as dependentes do papel da plataforma) e views públicas com colunas explícitas; precisa vir após a migration 3.
5. `20261007000500_feature_alignment.sql` — complementos de schema para funcionalidades do frontend e triggers compatíveis.
6. `20261007000600_policy_fixes.sql` — concede acesso à view pública segura criada na migration 4; policies permissivas legadas foram omitidas.
7. `20261007000700_storage.sql` — bucket de imagens e policies do Storage.
8. `20261007000800_rls_hardening.sql` — remove policies públicas anteriores nas tabelas de negócio e instala regras por tenant/ownership e papel.
9. `20261007000900_profile_guard.sql` — bloqueia alterações de `role` e `company_id` em perfis, exceto para `platform_admin` e `service_role`.
10. `20261007001000_signup_lockdown.sql` — redefine `handle_new_user` para criar todo perfil como `vendedor` sem empresa, ignorando `role` e `company_id` dos metadados de signup. O provisionamento administrativo define esses campos explicitamente após criar o usuário.
11. `20261007001200_rls_views_ownership.sql` — aplica RLS às views de relatório, retira leitura anônima, corrige bypass administrativo do guard e limita leads/negociações de vendedores aos próprios registros.
12. `20261007001300_tenant_integrity_storage.sql` — adiciona chaves estrangeiras compostas para vínculos entre tenants, restringe escrita no Storage pelo prefixo da empresa e limita `EXECUTE` das funções `SECURITY DEFINER`.
13. `20261007001400_public_lead_captcha.sql` — remove a inserção pública direta em `leads`; novos leads devem passar pela Edge Function `public-lead`, que valida o Turnstile e grava com `service_role`. Restringe também registros financeiros e de troca ao ownership das negociações.
14. `20261007001600_t9_security.sql` — permite que administradores atribuam negociações a vendedores da própria loja, restringe vendedores aos próprios registros relacionados e endurece o guard de perfil.

## Formulário público de leads (Turnstile)

- Configure `TURNSTILE_SECRET_KEY` como secret das Supabase Edge Functions (`supabase secrets set TURNSTILE_SECRET_KEY=...`). Ela nunca deve ser exposta ao navegador.
- Configure `VITE_TURNSTILE_SITE_KEY` no ambiente de build do frontend. A site key é pública e usada para renderizar o widget no formulário.
- A função `supabase/functions/public-lead` exige o token Turnstile, uma empresa ativa e um veículo disponível pertencente à empresa antes de inserir o lead.

As migrations numeradas são reexecutáveis quanto a policies/triggers (`DROP ... IF EXISTS` antes do `CREATE`); DDL de tabelas/índices usa `IF NOT EXISTS` e funções/views usam `OR REPLACE` quando compatível.

## Regras e ambiguidades

- Vendedores veem apenas os próprios leads e negociações; administradores veem todos os registros da própria loja.
- O formulário público insere leads sem sessão; a empresa precisa estar ativa e, quando informado, o veículo precisa pertencer à empresa indicada. Não há rate limit nem verificação anti-spam no SQL.
- Clientes autenticados só podem ler/editar o próprio registro. O fluxo de cliente público não tem regra de ownership verificável; permanece fechado até o modelo de vínculo ser decidido.
- Uploads de Storage preservam as regras antigas por autenticação e papel; associação do caminho do objeto ao tenant ainda não está modelada.
- `REFERENCE_MODELO_FISICO_COMPLETO.sql` foi movido para `supabase/reference/` e reduzido aqui a marcador para evitar execução acidental.
