# Repositórios no servidor — plano de migração

**Objetivo:** o cliente deixar de mandar SQL. Enquanto `/api/db` existir, uma
sessão válida alcança a linha de qualquer usuário — que é o buraco que o proxy
não fechou, e está dito no README.

**Spec:** `docs/superpowers/specs/2026-08-31-samsung-health-design.md` (seção do
proxy) e o cabeçalho de `api/_lib/rpc-core.ts`.

## A forma

Nada de 250 endpoints escritos à mão. Os repositórios já são
`(db, userId, ...args)`, e é essa forma que permite um despacho de dez linhas:

```
api.rotina.listDias(routineId)      cliente: só o NOME e os argumentos
  → POST /api/rpc                   { chamadas: [{ nome, args }] }
  → REGISTRO["rotina.listDias"]     servidor escolhe a função
  → listDias(db, userId, routineId) userId vem do TOKEN
```

Os repositórios não mudam. O que muda é o hook: `fn(db, userId, …)` vira
`api.modulo.fn(…)`, e o tipo sai do próprio repositório por `import type`, que
o build apaga.

## Estado

- [x] **Fundação** — `rpc-core` (despacho, lote, isolação de erro por chamada,
      guarda contra nome herdado do protótipo), `/api/rpc`, rota no dev,
      cliente tipado com junção de chamadas, `criarApiLocal` para os testes
      usarem o MESMO registro do servidor.
- [x] **rotina** — 11 operações. Provado em teste que a sessão de um usuário
      não lê nem escreve a rotina de outro pelo id.
- [x] sessao
- [x] workouts
- [x] plano
- [x] entries
- [x] meals
- [x] meal-templates
- [x] foods
- [x] food-measures
- [x] exercises
- [x] muscle-groups
- [x] activities
- [x] calistenia
- [x] progresso
- [x] profile
- [x] weighins
- [x] water
- [x] ai
- [x] users
- [x] dispositivos
- [x] **Desligar `/api/db`** — feito. A rota, o cliente `db-remoto` e o `db` do
      contexto foram removidos; o app roda com `/api/login`, `/api/rpc`,
      `/api/codigo`, `/api/parear` e `/api/ingest`.

**Concluído.** 19 módulos, 125 operações registradas, 25 hooks migrados.

## O que a migração vai expor, e precisa consertar

Várias funções não recebem `userId`, então não filtram por dono:

| Função | O que dá para fazer hoje |
|---|---|
| `plano.listBlocos(db, planId)` | ler os blocos do plano de qualquer um, pelo id |
| `plano.listItensPorBloco(db, planId)` | idem, com os itens |
| `foods.deleteFood(db, id)` | apagar alimento do catálogo compartilhado |
| `foods.updateFood(db, id, …)` | editar alimento de outro usuário |
| `food-measures.deleteMeasure(db, id)` | apagar medida caseira alheia |
| `food-measures.updateMeasure(db, id, …)` | idem |

**Consertadas:** as cinco leituras do plano e da favorita (`listBlocos`,
`listItensPorBloco`, `listMacros`, `listSubstituicoes`, `listTemplateItems`)
ganharam `userId` e `JOIN` com a tabela dona, com teste de isolamento.

**Não consertadas, e o motivo:** `foods` e `food_measures` **não têm coluna de
dono no schema**. O catálogo de alimentos é compartilhado por desenho neste
app — inclusive os alimentos que você cadastra. Registrá-las como `usuario`
seria mentir sobre uma posse que o banco não guarda. Dar posse a elas é
mudança de produto: exige coluna nova, migração do que já existe e uma decisão
sobre o que acontece com a TACO. Fica no roadmap.

## Regra de execução

Um módulo por vez, suíte verde a cada passo. `/api/db` continua servindo o que
ainda não migrou: as duas rotas coexistem de propósito, e é isso que torna a
migração incremental em vez de um salto.
