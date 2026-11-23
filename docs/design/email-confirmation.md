# Confirmação de email no cadastro de assinatura

## Intenção

Confirmar que o responsável controla o email informado antes de registrar uma solicitação de assinatura, sem contratar uma API de validação. A conta definitiva hoje só é criada após a confirmação manual do pagamento.

## Abordagens

- **Sintaxe e domínio:** não prova que a pessoa acessa a caixa postal.
- **Link mágico do Supabase Auth (escolhida):** comprova acesso e usa o Auth existente; cria uma conta sem empresa antes do pagamento, que o painel já restringe.
- **Token próprio e email transacional:** evita conta antecipada, mas exige criar envio e armazenamento de tokens além do Auth disponível.

## Comportamento e limites

- Guardar o formulário no navegador, solicitar link mágico e só criar `subscription_requests` após a confirmação.
- Validar no servidor JWT, `email_confirmed_at` e correspondência do email; não confiar em metadados enviados pelo cliente.
- Reutilizar a conta confirmada no provisionamento após o pagamento.
- O rascunho fica no navegador que iniciou o cadastro; link em outro navegador exige reenviar o formulário.
- Confirmação prova acesso à caixa naquele momento, não garante que o endereço não seja descartável.
- O envio depende da configuração de email do Supabase Auth e da URL de callback permitida no projeto.

## Implementação

1. Alterar `Register.tsx` para salvar o rascunho, pedir link mágico via Supabase Auth e mostrar o estado de confirmação.
2. Criar callback `/auth/register/confirm` para recuperar sessão, validar email confirmado, enviar rascunho à Edge Function e permitir nova tentativa.
3. Remover Verifalia e exigir JWT válido com email confirmado igual ao email do pedido antes de inserir a solicitação.
4. Alterar `admin-provision` para reutilizar a conta confirmada sem empresa, atualizar senha/perfil e manter rollback.
5. Rodar os checks locais aplicáveis.
