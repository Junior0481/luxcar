# Supabase migrations

Aplicar apenas os arquivos numerados, em ordem crescente, com Supabase CLI em ambiente controlado. Não aplique `REFERENCE_MODELO_FISICO_COMPLETO.sql`: ele preserva um modelo alternativo antigo, não uma etapa. Scripts anteriores não estabelecem o estado real do banco; audite/alinhe qualquer banco existente antes da primeira aplicação.

1. `20261007000100_initial_schema.sql` — tabelas centrais, índices, funções, triggers e views iniciais.
2. `20261007000200_multitenant.sql` — companies, vínculo de tenant, clientes, leads, trocas, triggers e view pública; semente fixa de empresa legada.
3. `20261007000300_platform_admin.sql` — papel de plataforma, políticas de perfil/empresa, criação de venda e RPCs.
4. `20261007000400_white_label.sql` — branding, pagamentos, preferências, funções de tenant, policies e views públicas com colunas explícitas.
5. `20261007000500_feature_alignment.sql` — complementos de schema para funcionalidades do frontend e triggers compatíveis.
6. `20261007000600_policy_fixes.sql` — concede acesso à view pública segura criada na migration 4; policies permissivas legadas foram omitidas.
7. `20261007000700_storage.sql` — bucket de imagens e policies do Storage.
8. `20261007000800_rls_hardening.sql` — remove policies públicas anteriores nas tabelas de negócio e instala regras por tenant/ownership e papel.
9. `20261007000900_profile_guard.sql` — bloqueia alterações de `role` e `company_id` em perfis, exceto para `platform_admin` e `service_role`.
10. `20261007001000_signup_lockdown.sql` — redefine `handle_new_user` para criar todo perfil como `vendedor` sem empresa, ignorando `role` e `company_id` dos metadados de signup. O provisionamento administrativo define esses campos explicitamente após criar o usuário.

As migrations numeradas são reexecutáveis quanto a policies/triggers (`DROP ... IF EXISTS` antes do `CREATE`); DDL de tabelas/índices usa `IF NOT EXISTS` e funções/views usam `OR REPLACE` quando compatível.

## Regras e ambiguidades

- O esquema não define se vendedores devem compartilhar todos os registros da loja ou ver somente os próprios. As regras atuais permitem leitura por tenant e restringem criação de negociação ao vendedor autenticado; atualizações de negociação são por tenant.
- O formulário público precisa inserir leads sem sessão. A regra exige empresa ativa e, quando informado, veículo pertencente à empresa indicada. Não há rate limit nem verificação anti-spam no SQL.
- Clientes autenticados só podem ler/editar o próprio registro. O fluxo de cliente público não tem regra de ownership verificável; permanece fechado até o modelo de vínculo ser decidido.
- Uploads de Storage preservam as regras antigas por autenticação e papel; associação do caminho do objeto ao tenant ainda não está modelada.
- `REFERENCE_MODELO_FISICO_COMPLETO.sql` foi movido para `supabase/reference/` e reduzido aqui a marcador para evitar execução acidental.
