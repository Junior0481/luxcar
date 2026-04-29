# 🚀 Guia de Instalação - AutoGest

## Passos para Configurar o Sistema

### 1️⃣ Configurar Supabase

1. **Criar projeto no Supabase**
   - Acesse https://supabase.com
   - Clique em "New Project"
   - Escolha um nome para o projeto (ex: autogest-production)
   - Defina uma senha forte para o banco de dados
   - Escolha a região mais próxima do Brasil (ex: South America - São Paulo)
   - Aguarde a criação do projeto (2-3 minutos)

2. **Obter credenciais**
   - No menu lateral, vá em "Settings" → "API"
   - Copie:
     - **Project URL** (começa com https://)
     - **anon public** key (a chave pública)

3. **Executar o Schema do Banco de Dados**
   - No menu lateral, vá em "SQL Editor"
   - Clique em "New Query"
   - Abra o arquivo `supabase-schema.sql` deste projeto
   - Copie TODO o conteúdo e cole no SQL Editor
   - Clique em "Run" (ou pressione Ctrl/Cmd + Enter)
   - Aguarde a confirmação: "Success. No rows returned"

   **⚠️ Importante**: Execute o arquivo completo de uma vez só!

4. **Verificar se as tabelas foram criadas**
   - No menu lateral, vá em "Table Editor"
   - Você deve ver as seguintes tabelas:
     - ✅ profiles
     - ✅ vehicles
     - ✅ vehicle_costs
     - ✅ negotiations
     - ✅ interaction_history
     - ✅ sales

5. **Configurar o Storage para Fotos**
   - No menu lateral, vá em "SQL Editor"
   - Clique em "New Query"
   - Abra o arquivo `supabase-storage-setup.sql` deste projeto
   - Copie e cole o conteúdo no SQL Editor
   - Clique em "Run"
   - Vá em "Storage" no menu lateral
   - Você deve ver o bucket "vehicles" criado

### 2️⃣ Configurar Variáveis de Ambiente

1. **Criar arquivo .env**
   ```bash
   cp .env.example .env
   ```

2. **Editar o arquivo .env**
   Abra o arquivo `.env` e adicione suas credenciais:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica-aqui
   VITE_FIPE_API_URL=https://parallelum.com.br/fipe/api/v1
   ```

### 3️⃣ Instalar Dependências

```bash
pnpm install
```

### 4️⃣ Iniciar o Servidor

```bash
pnpm dev
```

O sistema estará disponível em: http://localhost:5173

### 5️⃣ Criar Primeiro Usuário

1. Acesse http://localhost:5173/auth/register
2. Preencha:
   - Nome completo
   - Email
   - Senha (mínimo 6 caracteres)
   - Tipo de conta: **Administrador**
3. Clique em "Criar conta"
4. Faça login com as credenciais criadas

### 6️⃣ Testar o Sistema

**Cadastrar um veículo:**
1. Acesse "Veículos" no menu
2. Clique em "Novo Veículo"
3. Use a busca FIPE para obter o valor de mercado
4. Preencha os dados e cadastre

**Criar uma negociação:**
1. Acesse "Negociações"
2. Clique em "Nova Negociação"
3. Selecione um veículo disponível
4. Preencha dados do cliente
5. Acompanhe o estágio

## 🔧 Troubleshooting

### Erro: "Missing Supabase environment variables"
- ✅ Verifique se o arquivo `.env` existe
- ✅ Confirme se as variáveis estão preenchidas corretamente
- ✅ Reinicie o servidor após modificar o `.env`

### Erro ao fazer login: "Invalid login credentials"
- ✅ Verifique se o usuário foi criado corretamente
- ✅ Confirme a senha (mínimo 6 caracteres)
- ✅ Verifique se o schema do banco foi executado

### Tabelas não aparecem no Supabase
- ✅ Execute o arquivo `supabase-schema.sql` completo
- ✅ Verifique se não houve erro no SQL Editor
- ✅ Atualize a página do Table Editor

### Erro: "row-level security policy"
- ✅ O schema já configura RLS automaticamente
- ✅ Verifique se o schema foi executado completamente
- ✅ Confirme se está logado no sistema

## 📊 Estrutura do Banco de Dados Criada

Após executar o schema, você terá:

### Tabelas:
- `profiles` - Perfis de usuários
- `vehicles` - Cadastro de veículos
- `vehicle_costs` - Custos e manutenções
- `negotiations` - Negociações
- `interaction_history` - Histórico de interações
- `sales` - Vendas finalizadas

### Views:
- `vehicles_with_negotiations` - Veículos com negociações ativas
- `dashboard_metrics` - Métricas para o dashboard

### Triggers:
- Atualização automática de `updated_at`
- Criação automática de perfil ao registrar

### RLS (Row Level Security):
- Políticas configuradas para todos os perfis
- Controle de acesso por usuário
- Administradores têm permissões extras

## 🎯 Próximos Passos

1. ✅ Cadastre seus veículos
2. ✅ Convide vendedores (criar contas para eles)
3. ✅ Configure custos e manutenções
4. ✅ Inicie negociações
5. ✅ Acompanhe relatórios

## 🚀 Deploy em Produção

Para deploy, considere:
- **Vercel** (recomendado para Next.js/React)
- **Netlify** (fácil configuração)
- **Railway** (para full-stack)

Lembre-se de configurar as variáveis de ambiente na plataforma escolhida!

## 📞 Suporte

Caso encontre problemas:
1. Verifique este guia novamente
2. Consulte a documentação do Supabase: https://supabase.com/docs
3. Abra uma issue no GitHub do projeto

---

**Boa sorte com seu sistema de gerenciamento de concessionária! 🚗💨**
