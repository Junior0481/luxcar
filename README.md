# 🚗 AutoGest - Sistema SaaS para Gerenciamento de Concessionária

Sistema completo para gerenciamento de concessionárias e lojas de veículos, com foco em controle de estoque, negociações e comunicação interna entre vendedores.

## 🎯 Funcionalidades Principais

### ✅ Autenticação e Controle de Acesso
- Sistema de login e registro
- Perfis de usuário: Vendedor e Administrador
- Controle de acesso baseado em funções (RBAC)

### 🚙 Gerenciamento de Veículos (CRUD Completo)
- Cadastro de veículos com informações detalhadas
- Controle de status: Disponível, Em Negociação, Vendido
- Gestão de estoque em tempo real
- Filtros e busca avançada

### 💰 Controle Financeiro
- Registro de valor de compra e venda
- Controle de custos adicionais (manutenção, estética, mecânica)
- Cálculo automático de lucro estimado
- Integração com Tabela FIPE para valores de mercado

### 🤝 Sistema de Negociações
- Registro de negociações por veículo
- Acompanhamento de estágios (Primeiro Contato → Finalizado)
- **Alertas visuais** quando veículo está em negociação
- Histórico completo de interações
- Sistema de prioridades (Baixa, Média, Alta)

### 📊 Dashboard e Relatórios
- Métricas em tempo real
- Indicadores de performance
- Relatórios de vendas por período
- Análise de giro de estoque

### 🔧 Histórico de Manutenções
- Registro de manutenções realizadas
- Controle de custos por veículo
- Histórico completo de serviços

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript
- **Roteamento**: React Router v7 (Data mode)
- **Estilização**: Tailwind CSS v4
- **Backend/Database**: Supabase
  - PostgreSQL
  - Authentication
  - Row Level Security (RLS)
  - Real-time subscriptions
- **Gráficos**: Recharts
- **Ícones**: Lucide React

## 📋 Pré-requisitos

- Node.js 18+ e pnpm
- Conta no Supabase (gratuita)

## 🚀 Instalação e Configuração

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd autogest
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure o Supabase

#### 3.1. Crie um projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova organização e projeto
3. Anote a **URL do projeto** e a **anon key**

#### 3.2. Execute o schema do banco de dados
1. No dashboard do Supabase, vá em **SQL Editor**
2. Abra o arquivo `supabase-schema.sql` deste projeto
3. Copie e cole o conteúdo completo no SQL Editor
4. Clique em **Run** para executar

Isso criará:
- Todas as tabelas necessárias
- Triggers automáticos
- Row Level Security (RLS)
- Views para relatórios
- Função para criar perfis automaticamente

### 4. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione suas credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

### 5. Inicie o servidor de desenvolvimento

```bash
pnpm dev
```

O sistema estará disponível em `http://localhost:5173`

## 👤 Primeiro Acesso

1. Acesse a tela de registro em `/auth/register`
2. Crie sua primeira conta (será um Administrador por padrão)
3. Faça login com suas credenciais
4. Comece cadastrando seus primeiros veículos!

## 📖 Guia de Uso

### Cadastrando Veículos

1. Acesse **Veículos** no menu lateral
2. Clique em **Novo Veículo**
3. Preencha os dados:
   - Marca, Modelo, Ano, Versão
   - Valores de compra e venda
   - Informações técnicas (cor, placa, km, combustível)
4. Clique em **Cadastrar**

### Gerenciando Negociações

1. Acesse **Negociações** no menu
2. Clique em **Nova Negociação**
3. Selecione o veículo disponível
4. Preencha dados do cliente
5. Acompanhe o estágio da negociação
6. Adicione interações ao histórico

**⚠️ Importante**: Quando um veículo entra em negociação, o sistema exibe alertas visuais para todos os vendedores, evitando conflitos!

### Adicionando Custos e Manutenções

1. Acesse os detalhes de um veículo
2. Na seção **Custos e Manutenções**, clique em **Adicionar**
3. Selecione o tipo de custo
4. Informe descrição e valor
5. O lucro estimado será recalculado automaticamente

## 🏗️ Estrutura do Projeto

```
src/
├── app/
│   ├── components/         # Componentes reutilizáveis
│   │   ├── layouts/        # Layouts (Auth, Dashboard, Root)
│   │   ├── CostForm.tsx
│   │   ├── InteractionForm.tsx
│   │   ├── NegotiationForm.tsx
│   │   └── VehicleForm.tsx
│   ├── pages/              # Páginas da aplicação
│   │   ├── Dashboard.tsx
│   │   ├── Vehicles.tsx
│   │   ├── VehicleDetails.tsx
│   │   ├── Negotiations.tsx
│   │   ├── NegotiationDetails.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── NotFound.tsx
│   ├── routes.tsx          # Configuração de rotas
│   └── App.tsx             # Componente principal
├── contexts/
│   └── AuthContext.tsx     # Contexto de autenticação
├── lib/
│   └── supabase.ts         # Cliente e tipos do Supabase
└── styles/                 # Estilos globais
```

## 🔐 Segurança

- **Row Level Security (RLS)** habilitado em todas as tabelas
- Políticas de acesso baseadas em perfis
- Autenticação JWT via Supabase
- Validação de dados no frontend e backend

## 📊 Modelo de Dados

### Principais Tabelas

- **profiles**: Perfis de usuários (vendedor/administrador)
- **vehicles**: Cadastro de veículos
- **vehicle_costs**: Custos e manutenções
- **negotiations**: Negociações de venda
- **interaction_history**: Histórico de interações
- **sales**: Vendas finalizadas

## 🎨 Planos SaaS (Futuro)

- **Bronze**: Até 50 veículos
- **Prata**: Até 200 veículos + Relatórios avançados
- **Gold**: Veículos ilimitados + API + White Label

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT.

## 📧 Suporte

Para dúvidas ou suporte, abra uma issue no GitHub.

---

Desenvolvido com ❤️ para revolucionar o gerenciamento de concessionárias no Brasil 🇧🇷
