# Prompt para o Codex

Copie a pasta `luxcar-design-handoff/` para `docs/design/` na raiz do repositório e cole o texto abaixo no Codex. Rode uma fase por vez e revise o diff antes de seguir.

---

Você vai implementar um redesign visual no app LuxCar (React + Vite + Tailwind + shadcn/ui, dados no Supabase).

A especificação está em `docs/design/DESIGN.md` e os mockups de cada tela em `docs/design/screens/*.html`. Leia o DESIGN.md inteiro antes de começar. Os mockups são HTML estático: use os valores dos `style` inline (cores, tamanhos, espaçamentos, raios) como fonte da verdade e traduza para classes Tailwind e tokens CSS. Não copie o markup do editor (`<x-dc>`, `<helmet>`, `<script type="text/x-dc">`).

Regras:

- É uma mudança visual. Não altere queries do Supabase, contextos, rotas, regras de permissão nem a lógica de negócio. Se uma tela do mockup precisa de um dado que não existe, faça o layout com o que existe e deixe `// TODO(design): <o que falta>`.
- Os nomes de clientes, valores e contagens dos mockups são exemplos. Nunca hardcode; ligue tudo aos dados reais que a página já carrega.
- Reaproveite os componentes de `src/app/components/ui/` (button, card, badge, input, select, table, dialog etc.) e ajuste as variantes deles em vez de criar componentes paralelos. Use lucide-react para ícones.
- Mantenha acessibilidade: `<button>` e `<a>` reais, `<label>` em todo input, `aria-label` em botões só com ícone, contraste mínimo 4.5:1.
- Todas as telas precisam funcionar no celular (sidebar empilha, tabelas com rolagem horizontal, toolbars quebram linha).
- O tema escuro é o modo desenhado para o painel. Mantenha o toggle de tema funcionando: para o modo claro, use os tokens do site público do DESIGN.md como base.
- Ao fim de cada fase rode `npm run build` (e lint/testes, se existirem) e corrija os erros.

Fases (uma por vez, me mostre o resumo do diff ao final de cada uma):

1. **Fundação**: tokens do DESIGN.md em `src/styles/index.css` (variáveis CSS) e na config do Tailwind; trocar Inter por Barlow / Barlow Semi Condensed / Barlow Condensed; raio 8px/12px; remover sombras dos cards do painel; ajustar variantes de Button, Card, Badge (status), Input, Select e Table.
2. **Shell do painel**: `DashboardLayout.tsx` conforme `painel-sidebar.html` (grupos Operação/Gestão, item ativo, bloco da loja, usuário no rodapé) e a estrutura de página (cabeçalho com título, subtítulo e ações).
3. **Estoque**: `Vehicles.tsx` (`painel-estoque.html`) e `VehicleDetails.tsx` (`painel-veiculo-detalhe.html`).
4. **Vendas**: `Leads.tsx`, `Negotiations.tsx` (quadro kanban + lista), `NegotiationDetails.tsx`.
5. **Gestão**: `Dashboard.tsx`, `Payments.tsx`, `Reports.tsx`, `Team.tsx`, `Settings.tsx` (aba Marca com prévia).
6. **Site público**: `Login.tsx`/`AuthLayout.tsx`, `PublicHome.tsx` (vitrine, incluindo os filtros que hoje não abrem), `PublicVehicleDetails.tsx`, `Landing.tsx`.

Comece pela fase 1.
