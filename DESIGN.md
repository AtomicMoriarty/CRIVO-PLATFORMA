# Crivo — Sistema de Design

> Fonte da verdade visual do Crivo. Os tokens abaixo já existem no código
> (`app/index.html`, bloco `:root` no `<style>` e `tailwind.config`). Este
> documento descreve o que está implementado — ao criar telas novas, reutilize
> estes tokens e componentes; não invente paleta, fonte ou raio novos.

Identidade: **editorial, sóbria e técnica** — pense Stripe/Linear com gravidade
de banca jurídica. Fundo navy escuro + dourado de acento, tipografia serifada
nos títulos. NÃO é um SaaS genérico colorido. Evite o "AI slop": gradientes
roxo/ciano, glassmorphism por toda parte, sombras coloridas, raios gigantes,
bounce/elastic, hero dentro de tela interna.

## Cores (papel → valor)

| Papel | Token CSS | Valor |
|---|---|---|
| Fundo base | `--ink` | `#0A1420` |
| Superfície elevada | `--ink2` / `--ink3` | `#12202F` / `#1A2D42` |
| Card | `--card` / `--card2` | `rgba(255,255,255,.035 / .06)` |
| Texto primário | `--cream` | `#F4F0E8` |
| Texto secundário | `--muted2` | `#8A96A8` |
| Texto terciário/label | `--muted` | `#6B7A8D` |
| Borda | `--bd` / `--bd2` | `rgba(255,255,255,.07 / .12)` |
| Acento (marca) | `--gold` | `#C8963A` |
| Acento hover/realce | `--gold2` / `--gold3` | `#E8B050` / `#F5D080` |
| Borda dourada | `--gold-bd` / `--gold-bd2` | `rgba(200,150,58,.25 / .5)` |
| Sucesso | `--success` (Tailwind `success`) | `#3DB882` |
| Atenção | `--warning` | `#E0913A` |
| Perigo/erro | `--danger` | `#E05252` |

Regra de acento: **um dourado**, mais as três cores semânticas. Nunca um segundo
acento de marca (não acrescente azul/roxo). O azul que aparece no código é só
resíduo de classes Tailwind antigas, remapeado para dourado via CSS.

### Faixas do Score (função `risk()`)
- `≥ 800` → Baixo risco → verde (`fill-g`)
- `600–799` → Médio risco → âmbar (`fill-a`)
- `< 600` → Alto risco → vermelho (`fill-r`)

## Tipografia

| Uso | Família | Token |
|---|---|---|
| Títulos / números de destaque | Playfair Display | `font-serif` |
| Corpo / UI | IBM Plex Sans | `font-sans` (padrão) |
| Rótulos, métricas, kicker | IBM Plex Mono | `font-mono` / `.mono-label` |

Corpo padrão 14–16px, `line-height` 1.5. Títulos usam `tracking` levemente
negativo (`.font-serif{letter-spacing:-.02em}`).

## Espaçamento e forma

- Escala: múltiplos de 4 (use as classes Tailwind `p-3/4/5/6`, `gap-2/3/4`).
- Raio: `rounded-md` 6px (botões compactos), `rounded-lg` 8px (botões/inputs),
  `rounded-xl` 10px (cards/modais). **Não** passe de ~12px.
- Sombra: discreta. Cards usam a linha dourada do `.card-lift`, não sombra
  pesada. Sombra colorida/glow é proibida.

## Componentes utilitários (já existem — reutilize)

- `.eyebrow` — kicker mono em caixa-alta com ponto pulsante. Use com parcimônia,
  no topo de seções públicas. Não espalhe em telas internas.
- `.mono-label` — rótulo mono 10px caixa-alta para metadados.
- `.gold-panel` — painel com leve degradê dourado (destaque de seção/plano).
- `.card-lift` — card com elevação sutil e linha dourada no hover (sem `scale`).
- `.glass` — fundo translúcido com blur; uso restrito ao header fixo.
- `.skel` — skeleton shimmer para loading; reproduza a estrutura real do conteúdo.
- `Reveal` / `CountUp` — animações de entrada e contagem; respeitam
  `prefers-reduced-motion`.
- Primitivos React (via `h()`): `Card`, `Button` (`primary`/`ghost`/`danger`),
  `Field`, `Input`, `Select`, `Notice` (`info/gold/success/warning/danger`),
  `SuccessPanel`, `Toasts` (`toast(msg, "ok"|"error")`).

## Movimento

- Transições 100–200ms, só em `opacity`/`color`/`border`/leve `translateY`.
- Proibido: `scale` em hover de card, bounce/elastic, slide-in de modal,
  animações concorrentes que atrasam o conteúdo.
- Sempre respeitar `@media (prefers-reduced-motion: reduce)` (já no CSS).

## Acessibilidade (mínimos do projeto)

- Modais: `role="dialog"`, `aria-modal`, `aria-labelledby`, foco preso, Esc
  fecha, foco devolvido à origem (hook `useModalA11y`).
- Contraste mínimo 4.5:1 para texto pequeno; foco visível (`:focus-visible`
  dourado já definido).
- Toggles com `aria-expanded`/`aria-controls`; ícones decorativos com
  `aria-hidden`.

## Regras de conteúdo inegociáveis (PRD §7.3)

- O Score é **"indicador estatístico de aderência tributária"**. NUNCA escreva
  "certificação", "crédito garantido" ou "recomendação tributária".
- `ScoreDisclaimer` é **obrigatório** em toda tela/modal que exibe score.
- Linguagem em português claro; números em pt-BR (`Intl.NumberFormat`).

## Arquitetura (consciente — ver CLAUDE.md)

Frontend é **arquivo único** `app/index.html`: React 18 via esm.sh, sem build,
sem JSX (`h()` = `createElement`), Tailwind via CDN + tema dark no `<style>`.
Não migrar para Vite/JSX/TS sem justificativa explícita do dono. Validar antes
de publicar: extrair o `<script type="module">` e rodar `node --check`.
