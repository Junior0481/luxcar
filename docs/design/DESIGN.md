# LuxCar — Especificação do redesign

Referência visual para implementar o novo design no app (React + Vite + Tailwind + shadcn/ui).
Os arquivos em `screens/` são mockups HTML estáticos: os valores dos `style="..."` inline são os valores exatos a reproduzir.

## Como ler os mockups

- Cada `screens/*.html` é uma tela. Abra no navegador para ver (as fontes vêm do Google Fonts).
- `<x-dc>`, `<helmet>` e o `<script type="text/x-dc">` no fim são do editor de design. Ignore, o conteúdo útil é o markup dentro de `<x-dc>`.
- `<dc-import name="Sidebar" active="leads" ...>` = o menu lateral de `painel-sidebar.html`, com o item `leads` ativo.
- Em `painel-sidebar.html`, `{{n.<item>.bg}}` etc. trocam entre estado ativo (`bg #181C22`, texto `#FFFFFF`, peso 600, ícone na cor de destaque) e inativo (`bg transparent`, texto `#A3ABB8`, peso 500).
- `img/byd-*.jpg` são fotos de exemplo. **Todos os nomes de clientes, valores e contagens são dados de exemplo — nunca hardcode; use os dados reais do Supabase.**
- Textos entre colchetes (`[PREÇO]`, `[Depoimento ...]`, `[N] dias`) são placeholders de conteúdo que ainda não existe.

## Tokens

### Painel da loja (tema escuro — o modo desenhado)

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#0E1013` | Fundo da página |
| `--sidebar` | `#0A0C0F` | Menu lateral |
| `--card` | `#121519` | Cards, tabelas, painéis |
| `--card-raised` | `#171B21` | Cards dentro de cards (kanban, itens) |
| `--muted` | `#0F1216` | Cabeçalho de tabela |
| `--input` | `#14171C` | Fundo de inputs e botões secundários |
| `--border` | `#1F242B` | Borda de cards |
| `--border-strong` | `#2A3038` | Borda de inputs e botões secundários |
| `--row-divider` | `#1A1E24` | Linhas entre linhas de tabela |
| `--foreground` | `#E9ECF1` | Texto principal |
| `--heading` | `#FFFFFF` | Títulos e números grandes |
| `--muted-foreground` | `#A3ABB8` | Texto secundário, labels |
| `--subtle-foreground` | `#8A93A1` | Legendas, metadados |
| `--primary` | `#FF7A2F` | Cor de destaque (vem da marca da loja) |
| `--primary-foreground` | `#170A02` | Texto sobre o destaque (sempre escuro) |

Status (fundo / borda / texto):

| Status | Fundo | Borda | Texto |
| --- | --- | --- | --- |
| Sucesso (Disponível, Pago, Qualificado) | `#10261C` | `#1E4D36` | `#5BE3A0` (ponto `#3DD68C`) |
| Atenção (Em negociação, Pendente, Média) | `#2A2110` | `#4D3A16` | `#F5B54A` |
| Perigo (Alta, prejuízo) | `#2A1512` / `#24130F` | `#4A221A` | `#FF8C82` |
| Info (Novo, Vendido, Autorizado) | `#0F1B2E` | `#1E3558` | `#8DB8FF` (ponto `#5B8DEF`) |
| Neutro (etapa, Vendedor, Baixa) | `#161A20` | `#262B33` | `#C9CFD8` |
| Convertido | `#1C1730` | `#352B5A` | `#B9A6FF` |

### Site público (tema claro)

| Token | Valor |
| --- | --- |
| Fundo | `#F6F6F4` |
| Card | `#FFFFFF` |
| Borda | `#E4E4E0` (inputs `#D4D4CF`) |
| Texto | `#15171A` |
| Texto secundário | `#5C626B` |
| Botão escuro | `#15171A` com texto branco |
| WhatsApp | `#128C4A` com texto branco |

### Forma e tipografia

- Fontes: **Barlow** (400/500/600/700) para UI e texto; **Barlow Semi Condensed** (600/700) para títulos e números grandes; **Barlow Condensed** 700 só na placa do carro. Remover Inter.
- Números (preços, km, contagens): `font-variant-numeric: tabular-nums`.
- Raio: 8px botões e inputs, 12px cards, 999px pills. (Hoje é 14px em tudo.)
- Sombra: nenhuma no painel. Separação por borda de 1px.
- Escala: título de página 32px/700 Semi Condensed; título de card 19px/600 Semi Condensed; corpo 14px (painel) e 15–16px (site); legendas 12–13px.
- Alturas: botão 40px, input 38–40px, linha de navegação 38px, alvo mínimo 32px em ações de tabela.
- Ícones: lucide-react, stroke 1.75, 16–18px.

## Componentes

- **Shell do painel**: `flex flex-wrap`; sidebar `flex: 1 1 232px`; conteúdo `flex: 999 1 560px; min-width: 0`; padding do conteúdo `28px 32px 48px`, gap 20–24px. No celular a sidebar empilha.
- **Sidebar**: bloco da loja (logo 34px na cor de destaque + nome + "Centro da loja"), grupos "Operação" (Dashboard, Estoque, Leads, Negociações, Pagamentos) e "Gestão" (Relatórios, Equipe, Configurações), usuário no rodapé. Labels de grupo 11px uppercase `#6F7886`.
- **Cabeçalho de página**: título + subtítulo à esquerda, ações à direita (secundárias primeiro, primária por último).
- **Botão primário**: fundo `--primary`, texto `--primary-foreground`, 700. Só um por tela.
- **Botão secundário**: fundo `--input`, borda `--border-strong`, texto `--foreground`.
- **Faixa de KPIs**: um card só dividido por bordas verticais (não 4 cards separados). Label 13px, número 34px Semi Condensed, legenda 12px.
- **Tabela**: dentro de card, cabeçalho `--muted` 13px `--subtle-foreground`, células com padding `12px`, primeira/última coluna `20px`, divisória `--row-divider`. Números alinhados à direita. Envolver em `overflow-x: auto`.
- **Pill de status**: `padding 3px 9px`, 12px, 600, com ponto de 6px quando é estado do veículo.
- **Placa**: fundo branco, faixa azul `#1F4FA8` "BRASIL" em cima, Barlow Condensed 700.
- **Estado vazio**: ícone em quadrado 44px `#1A1E24`, título 14px/600, texto que explica o que entra ali.

## Telas → arquivos do app

| Mockup | Arquivo atual | Observações |
| --- | --- | --- |
| `painel-sidebar.html` | `components/layouts/DashboardLayout.tsx` | Fazer primeiro. Equipe/Configurações só para admin, como hoje. |
| `painel-dashboard.html` | `pages/Dashboard.tsx` | Mesmos blocos de hoje, reorganizados. |
| `painel-estoque.html` | `pages/Vehicles.tsx` | Tabela com miniatura, placa, margem colorida e tabs de status com contagem. |
| `painel-veiculo-detalhe.html` | `pages/VehicleDetails.tsx` | Painel de precificação: compra + custos = custo total → resultado e preço para empatar. |
| `painel-leads.html` | `pages/Leads.tsx` | Lista + painel lateral do lead selecionado com "Levar para negociação". |
| `painel-negociacoes.html` | `pages/Negotiations.tsx` | Quadro kanban por etapa (rolagem horizontal), alternando com a lista atual. |
| `painel-negociacao-detalhe.html` | `pages/NegotiationDetails.tsx` | Barra de etapas, proposta vs. preço, troca, histórico. |
| `painel-pagamentos.html` | `pages/Payments.tsx` | Resumo + tabela com ação por status + formulário lateral. |
| `painel-relatorios.html` | `pages/Reports.tsx` | KPIs, barras por mês, vendedor, giro. |
| `painel-equipe.html` | `pages/Team.tsx` | Tabela + formulário. |
| `painel-configuracoes-marca.html` | `pages/Settings.tsx` (aba Marca) | Formulário + prévia ao vivo da vitrine com a cor da loja. |
| `site-login.html` | `pages/Login.tsx` + `AuthLayout.tsx` | Trocar "Criar conta" por "Falar com vendas" se o cadastro for fechado. |
| `site-vitrine.html` | `pages/PublicHome.tsx` (/estoque) | Filtros visíveis na lateral, grid de cards, ordenação. Corrige o botão "Filtros" que não abre nada. |
| `site-anuncio.html` | `pages/PublicVehicleDetails.tsx` | WhatsApp como ação principal, ficha completa, barra fixa no celular. |
| `site-landing.html` | `pages/Landing.tsx` | Hero escuro com print do produto, 3 blocos, seção white label, plano, FAQ. |

## O que precisa de backend (não inventar no front)

Implementar a parte visual com os dados que já existem. Para o resto, deixar o espaço preparado e um `// TODO(design):`:

- Dias em estoque e alerta de "parado há mais de 60 dias" (precisa de `created_at` do veículo, se já existe pode calcular).
- Drag-and-drop no kanban (pode começar só visual, mudando etapa pelo select atual).
- Convite de equipe por e-mail no lugar de "senha inicial".
- Consulta FIPE, simulação de financiamento, favoritos.
- Valor de troca avaliado vs. pedido pelo cliente, se o campo não existir.
- Fotos: hoje são base64 no banco. O ideal é Supabase Storage com miniaturas; não é pré-requisito do redesign.
