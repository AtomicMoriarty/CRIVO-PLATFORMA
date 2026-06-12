# Plano de melhorias do frontend — selecionado em 2026-06-12

Auditoria: skills `motion-improve` + `ui-ux-pro-max` (achados com evidência em
`app/index.html`). Seleção do dono: todas as 12 melhorias + Tailwind compilado
+ 2 funcionalidades novas. Executor: a própria sessão (contexto completo), em
lotes commitados no branch `claude/gracious-mayer-qv9aq8`. Verificação por lote:
`node --check` no módulo extraído + smoke visual via Playwright antes do lote C.

Decisão registrada: proposta da ui-ux-pro-max de trocar paleta/tipografia por
tema claro genérico foi REJEITADA — preserva-se a identidade navy+dourado
(regra "design system existente prevalece").

| Lote | Itens | Status |
|---|---|---|
| A — Correções de fluxo | 1 recuperação de senha · 2 documento nasce pendente + badge de status + recálculo na aprovação · 3 added_by correto · 4 dimensões ativas calculadas | DONE |
| B — UX nas telas | 5 ícones SVG · 6 validação inline · 7 prova social/metodologia na home · 8 tabelas→cards no mobile · 9 busca+filtros no /admin · 10 expectativa de plano · 11 mostrar senha + força · 12 alvos de toque 44px | DONE |
| D — Página pública da empresa | rota /empresa/:cnpj (só listadas; sócios minimizados por LGPD; título dinâmico; link a partir do diretório/KYP) | DONE |
| E — Fluxo "Sou Fornecedor" | escolha de perfil no cadastro (?perfil=fornecedor), role=supplier, empresa tipo=fornecedor, pós-cadastro → /documentos | DONE |
| C — Tailwind compilado (por último: o CSS precisa varrer as classes finais) | gerar app/assets/tailwind.css via npx tailwindcss; trocar CDN pelo link; conferência classe a classe + screenshot | DONE |

Ordem: A → B → D → E → C (C por último para o build de CSS enxergar todas as
classes novas). Banco: brecha de auto-promoção role/plan fechada antes do plano
(migration 20260612120029, testada com ataque simulado).
