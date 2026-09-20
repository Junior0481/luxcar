# LuxCar

Sistema web para gestão de concessionárias e lojas de veículos, desenvolvido como projeto acadêmico. A aplicação centraliza o controle de estoque, custos, negociações, leads e indicadores comerciais, além de disponibilizar uma vitrine pública para consulta dos veículos cadastrados.

## Sobre o projeto

A LuxCar foi concebida para reduzir a dependência de planilhas e informações dispersas na rotina de uma loja automotiva. O sistema oferece uma interface pública para clientes e um ambiente interno para a equipe comercial, mantendo os dados integrados em uma única plataforma.

O projeto demonstra, na prática, conceitos de desenvolvimento de aplicações web, autenticação, controle de acesso, banco de dados relacional, integração com serviços externos e organização de uma aplicação em camadas.

## Objetivos

- Centralizar o cadastro e o acompanhamento dos veículos em estoque.
- Registrar custos, manutenções e informações financeiras de cada veículo.
- Organizar negociações e interações realizadas com clientes.
- Disponibilizar indicadores para apoiar decisões comerciais.
- Oferecer uma vitrine digital com os veículos disponíveis.
- Aplicar autenticação e regras de acesso aos dados da aplicação.

## Funcionalidades

### Ambiente público

- Apresentação institucional da plataforma.
- Consulta e filtragem dos veículos em estoque.
- Visualização dos detalhes de cada veículo.
- Cadastro e autenticação de clientes.
- Registro de interesse por meio de leads.

### Ambiente administrativo

- Autenticação de usuários internos.
- Dashboard com indicadores operacionais e comerciais.
- Cadastro, edição, consulta e exclusão de veículos.
- Controle de status do estoque.
- Registro de custos e manutenções.
- Acompanhamento das etapas de uma negociação.
- Histórico de interações com clientes.
- Registro de veículos recebidos como parte do pagamento.
- Relatórios de vendas e desempenho.
- Consulta de valores de referência por meio da API FIPE.

## Tecnologias utilizadas

| Tecnologia | Finalidade |
| --- | --- |
| React 18 | Construção da interface de usuário |
| TypeScript | Tipagem estática e maior segurança no desenvolvimento |
| Vite | Ambiente de desenvolvimento e geração da versão de produção |
| React Router | Definição e controle das rotas da aplicação |
| Tailwind CSS | Estilização e responsividade |
| Radix UI e Material UI | Componentes acessíveis e elementos de interface |
| Supabase | Autenticação, banco de dados PostgreSQL e armazenamento |
| Recharts | Visualização de indicadores e relatórios |
| API FIPE | Consulta de valores de referência de veículos |

## Arquitetura

A aplicação utiliza uma arquitetura cliente-servidor baseada em serviços:

```text
Usuário
   |
   v
Interface React
   |
   v
Camada de serviços
   |-------------------|
   v                   v
Supabase            API FIPE
Auth + PostgreSQL   Valores de referência
```

No frontend, as páginas e os componentes são responsáveis pela apresentação e pela interação com o usuário. A camada de serviços concentra o acesso aos dados. O Supabase fornece autenticação e persistência em PostgreSQL, com políticas de segurança em nível de linha (RLS).

## Estrutura do repositório

```text
luxcar/
├── src/
│   ├── app/
│   │   ├── components/     # Componentes e layouts da interface
│   │   ├── pages/          # Páginas públicas e administrativas
│   │   └── routes.tsx      # Configuração das rotas
│   ├── contexts/           # Estado global de autenticação
│   ├── hooks/              # Hooks reutilizáveis
│   ├── lib/                # Cliente Supabase e utilitários
│   ├── services/           # Regras de acesso e manipulação de dados
│   └── styles/             # Estilos globais e tema
├── DOCUMENTACAO_ACADEMICA.md # Especificação acadêmica do sistema
├── MODELO_FISICO_COMPLETO.sql # Modelo físico consolidado do banco
├── SETUP_GUIDE.md            # Guia complementar de configuração
└── supabase-*.sql            # Schema, migrações e ajustes do Supabase
```

## Pré-requisitos

- Node.js 18 ou superior.
- pnpm instalado.
- Projeto criado no Supabase.
- URL e chave anônima do projeto Supabase.

## Instalação e execução

1. Clone o repositório:

```bash
git clone https://github.com/Junior0481/luxcar.git
cd luxcar
```

2. Instale as dependências:

```bash
pnpm install
```

3. Crie o arquivo local de variáveis de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell, utilize:

```powershell
Copy-Item .env.example .env
```

4. Preencha as credenciais no arquivo `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
VITE_DEFAULT_COMPANY_SLUG=luxcar
```

5. No SQL Editor do Supabase, execute `MODELO_FISICO_COMPLETO.sql` em uma instalação nova. Em um banco existente, aplique as migrações versionadas em ordem. A migração `supabase-white-label-migration.sql` adiciona isolamento multitenant, identidade visual, pagamentos, relacionamento cliente-loja e as políticas RLS correspondentes.

6. Inicie o servidor de desenvolvimento:

```bash
pnpm dev
```

A aplicação ficará disponível, por padrão, em `http://localhost:5173`.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia o ambiente local de desenvolvimento |
| `pnpm build` | Gera a versão otimizada para produção |
| `pnpm test` | Executa os testes unitários e de integração |
| `pnpm test:coverage` | Gera o relatório de cobertura |
| `pnpm test:e2e` | Executa os fluxos E2E com Playwright |
| `pnpm test:e2e:headed` | Executa a jornada desktop com o navegador visível |
| `pnpm test:e2e:ui` | Abre a interface interativa do Playwright |
| `pnpm test:e2e:report` | Abre o último relatório HTML |
| `pnpm check` | Valida tipos, testes e build de produção |

### Validação navegável com Playwright

Os testes percorrem a vitrine pública em desktop e celular, monitoram erros de
JavaScript e validam as permissões de administrador, vendedor e cliente. Para
habilitar as jornadas autenticadas, configure no `.env` local as variáveis
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_SELLER_EMAIL`,
`E2E_SELLER_PASSWORD`, `E2E_CLIENT_EMAIL` e `E2E_CLIENT_PASSWORD`.

Por padrão, o Playwright compila e abre a aplicação localmente. Para testar o
deploy, informe também:

```env
E2E_BASE_URL=https://luxcar-six.vercel.app
```

Em caso de falha, ficam disponíveis relatório HTML, screenshot, vídeo e trace
de navegação. As credenciais E2E devem pertencer apenas a contas de teste e não
devem ser commitadas.

## Principais rotas

| Rota | Descrição |
| --- | --- |
| `/` | Apresentação da plataforma |
| `/estoque` | Vitrine pública de veículos |
| `/vehicles/:id` | Detalhes públicos de um veículo |
| `/auth/login` | Acesso de usuários internos |
| `/client/login` | Acesso de clientes |
| `/dashboard` | Painel administrativo |
| `/dashboard/vehicles` | Gestão do estoque |
| `/dashboard/negotiations` | Gestão das negociações |
| `/dashboard/payments` | Pagamentos vinculados às negociações |
| `/dashboard/reports` | Relatórios gerenciais |

## Fluxo de desenvolvimento

1. Crie uma branch a partir da `main`.
2. Implemente a alteração mantendo todas as consultas internas escopadas por `company_id`.
3. Para mudanças no banco, adicione uma migração SQL versionada e revise as políticas RLS.
4. Execute `pnpm check` antes de criar o commit.
5. Abra um pull request descrevendo impacto, testes e eventual procedimento de migração.

Nunca utilize `service_role` no frontend. Essa chave é exclusiva de rotinas administrativas executadas em ambiente seguro.

## Arquitetura white label

Cada empresa é um tenant independente. Usuários internos, veículos, negociações, vendas, pagamentos e relatórios são associados por `company_id`. O isolamento é aplicado simultaneamente na aplicação e nas políticas RLS do PostgreSQL.

Nome, logotipo, cores, favicon e domínio podem ser configurados por empresa. Clientes finais permanecem separados dos usuários internos e podem se relacionar com diversas lojas por meio de `customer_companies`.

## Processo de deploy

O projeto possui configuração para deploy na Vercel:

1. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_DEFAULT_COMPANY_SLUG` nas variáveis do projeto.
2. Aplique e valide previamente as migrações no Supabase.
3. Execute `pnpm check` localmente ou no pipeline de CI.
4. Publique a branch e valide o preview da Vercel.
5. Faça merge na `main` somente após os testes; a Vercel produzirá o deploy de produção.

Para domínios white label, cadastre o domínio na Vercel e preencha `custom_domain` na empresa correspondente.

## Banco de dados e segurança

O modelo de dados contempla entidades como perfis, lojas, veículos, custos, leads, negociações, interações e vendas. A segurança é apoiada pelos seguintes recursos:

- autenticação gerenciada pelo Supabase Auth;
- uso de JSON Web Tokens (JWT) nas sessões autenticadas;
- políticas de Row Level Security (RLS);
- separação entre as áreas pública e administrativa;
- validação de dados na camada de serviços.

As chaves privadas do ambiente não devem ser adicionadas ao controle de versão. O arquivo `.env.example` deve conter somente os nomes das variáveis necessárias.

## Documentação acadêmica

O arquivo [`DOCUMENTACAO_ACADEMICA.md`](DOCUMENTACAO_ACADEMICA.md) apresenta detalhes adicionais do trabalho, incluindo:

- atores e casos de uso;
- diagramas de caso de uso e de classes;
- wireframes das principais interfaces;
- modelagem do banco de dados;
- modelo entidade-relacionamento;
- arquitetura da aplicação;
- considerações de acessibilidade.

## Status do projeto

Projeto acadêmico em desenvolvimento. Algumas funcionalidades e regras de negócio podem passar por ajustes conforme a evolução dos requisitos e a validação dos testes.

## Autoria

Projeto desenvolvido para fins acadêmicos. Consulte o histórico do repositório para informações sobre autoria e contribuições.
