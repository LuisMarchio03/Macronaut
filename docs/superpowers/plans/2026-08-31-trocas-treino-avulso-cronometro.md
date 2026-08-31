# Trocas por item, treino avulso e cronômetro — plano de implementação

**Spec:** `docs/superpowers/specs/2026-08-31-trocas-treino-avulso-cronometro-design.md`
**Achados:** `docs/superpowers/achados-teste-manual-2026-08-31.md`

## Restrições globais

- **Tudo em português** — funções, variáveis, comentários, textos de tela, commits.
- **Comentário explica o PORQUÊ**, nunca o quê.
- **`src/domain/` é puro:** sem banco, sem React, sem `Date.now()`.
- **`src/repositories/` é a única camada com SQL.** Todo `WHERE` filtra por `user_id`.
- **TDD:** teste primeiro, ver falhar, implementar, ver passar.
- **Alvo de toque de 44px** em todo controle novo.
- **Tabela nova vai em `schema.sql`; coluna nova em tabela existente vai em
  `ADDITIVE_COLUMNS`** de `scripts/lib/apply-schema.ts` — num banco em uso o
  `CREATE TABLE IF NOT EXISTS` é no-op e a coluna nunca apareceria.
- Baseline a preservar: **1087 testes em 125 arquivos**.

---

## Frente A — Substituições por item

- [x] **A1** `plan_item_swaps` em `schema.sql`; `food_entries.plan_block_id` em
      `ADDITIVE_COLUMNS` + índice em `ADDITIVE_INDEXES`.
- [x] **A2** Domínio puro em `plano-dia.ts`: `trocaDoItem`, `descreverTroca`,
      `itensResolvidos`.
- [x] **A3** Repositório: `listTrocasDoDia`, `salvarTroca`, `removerTroca`.
- [x] **A4** Migração do `plan_checks.swap_id` legado, em `setup-db.ts`.
- [x] **A5** `marcarBloco` grava `food_entries` do que resolve; desmarcar apaga
      só o que aquele bloco lançou.
- [x] **A6** Hooks em `use-plano.ts`.
- [x] **A7** `SheetTrocas` em dois níveis, com as três origens e "Trocar tudo".
- [x] **A8** `BlocoCard`: "Trocar" em todo bloco com itens; rastro da troca.
- [x] **A9** Fiação no `dashboard.tsx`.

## Frente B — Treino avulso e sessão editável

- [x] **B1** `sessoesEmAndamento`: `LEFT JOIN` e sem `LIMIT 1`.
- [x] **B2** `treino.tsx`: lista as sessões abertas; ação "Treino avulso" sempre
      presente, com folha de nome.
- [x] **B3** `treino-sessao-detalhe.tsx` ganha "Adicionar exercício", inclusive
      no estado vazio.
- [x] **B4** `padraoDe(exercicio)` na rotina — cardio nasce cardio.
- [x] **B5** `criarRotina` desativa as anteriores.

## Frente C — Cronômetro

- [x] **C1** `chave = 0` é ocioso; some o `useRef` que trava o 1º descanso.
- [x] **C2** Sempre na tela durante a sessão.
- [x] **C3** Persistência em `localStorage` por `fim_ts` de relógio de parede.
- [x] **C4** Vibração + bipe ao zerar, com silenciar; `−15s` / `+15s`.
- [x] **C5** Tempo total do treino no cabeçalho da sessão.

## Frente D — Calistenia (pedida durante a execução)

- [x] **D1** Quinta aba "Calistenia" no `TreinoLayout`.
- [x] **D2** A aba "Hoje" do treino perde o card duplicado.
- [x] **D3** No dashboard o card vira `LinhaCalisteniaHoje` — uma linha com o
      resumo do dia e o `+` que mantém o registro em dois toques.

## Fechamento

- [x] **V1** `npm test` verde.
- [x] **V2** `npx tsc -b` limpo.
- [x] **V3** Varredura de navegador no dev server.
- [x] **V4** Varredura de navegador no **build de produção** — T4 só aparece lá.
