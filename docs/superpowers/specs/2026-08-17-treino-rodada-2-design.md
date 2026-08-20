# Treino, rodada 2: o módulo reagrupado por pergunta

**Data:** 2026-08-17
**Status:** aprovado
**Continua:** `2026-08-17-treino-rotina-design.md`
**Absorve:** os achados B3, B5, B6, B7, B8 e B9 de
`docs/superpowers/achados-teste-manual-2026-08-17.md`

## Problema

A rodada da rotina deixou quatro telas intocadas — cardio, exercícios,
histórico e progressão — e o teste manual mostrou por que isso incomoda: elas
não são só velhas, elas estão **organizadas pelo objeto errado**.

O hub oferece cinco destinos e nenhum deles é uma pergunta que alguém faz.
"Histórico" e "Progressão" respondem a mesma coisa — *o que eu já fiz* — em
duas linguagens, e quem quer saber se está evoluindo tem que adivinhar em qual
das duas procurar. Pior: a progressão só responde depois que você escolhe um
exercício num `<select>`, e antes disso é uma tela em branco (B7). O histórico,
por sua vez, não diz nada de uma sessão que teve só aquecimento (B3).

Cardio é um destino separado com um seletor de data que **não filtra a lista**
(B8) — o controle está lá, você mexe, e nada acontece. E cardio nunca pode ser
planejado: a rotina fala de séries e cargas, então "quinta é bike" não cabe.

## Objetivo

1. O hub deixa de ser um menu de objetos e vira um menu de perguntas: *o que
   eu treino hoje*, *o que eu treino na semana*, *o que eu já fiz*.
2. Cardio deixa de ser uma ilha: entra na rotina e na sessão como qualquer
   outro item.
3. Uma sessão passada pode ser aberta, lida série a série e corrigida.
4. Nenhuma tela do módulo continua com `<select>` nativo ou tela vazia sem
   saída.

## Não-objetivos

- Importar treino de planilha, GPS ou relógio.
- Zonas de frequência cardíaca, pace, distância. Cardio aqui é atividade,
  duração e calorias — o que o app já sabe estimar.
- Editar a rotina de dentro do detalhe de uma sessão passada.

---

## Parte 1 — A estrutura nova

| Rota | Pergunta que responde |
|---|---|
| `/treino` | O que eu treino **hoje**? |
| `/treino/rotina` | O que eu treino **na semana**? |
| `/treino/progresso` | O que eu **já fiz**? |
| `/treino/sessao` | *(a tela da academia)* |
| `/treino/sessao/:id` | O que eu fiz **naquele dia**? |

Saem: `/treino/historico`, `/treino/progressao` e `/treino/cardio`. A
biblioteca de exercícios sai de `/treino/exercicios` e vira `/exercicios`,
alcançável por `/mais` — é catálogo e configuração, não uma pergunta sobre
treino. O hub fica com **dois** atalhos no lugar de cinco.

---

## Parte 2 — Cardio como item da sessão

### A decisão de modelagem

Cardio vira **um exercício do catálogo**. Cada `activity_types` seeda um
`exercises` com `equipamento = 'cardio'` e `met` copiado, sem grupo muscular.

A alternativa era uma tabela paralela de itens de cardio na rotina e no plano.
Foi descartada porque a sessão renderiza **uma lista ordenada** — supino,
bike, rosca, na ordem em que você faz — e duas tabelas obrigariam a tela a
intercalar duas listas para desenhar uma. O custo de unificar é uma coluna
`met` em `exercises`; o custo de separar é toda leitura do plano virar um
merge.

```sql
-- colunas aditivas
ALTER TABLE exercises          ADD COLUMN met REAL;             -- só cardio
ALTER TABLE routine_exercises  ADD COLUMN duracao_min REAL;     -- só cardio
ALTER TABLE session_plan_sets  ADD COLUMN duracao_min REAL;     -- prescrito
ALTER TABLE session_plan_sets  ADD COLUMN activity_id INTEGER;  -- realizado
```

`routine_exercises.prescricao` ganha o valor `'cardio'`. `exercise_id`
continua `NOT NULL` — um item de cardio aponta para o exercício de cardio do
catálogo, e é por isso que cardio ser exercício vale a coluna `met`.

### O que muda em cada camada

**Domínio.** `planejar` ganha `{ tipo: "cardio"; duracao_min: number; met: number }`
e devolve **uma** `SeriePlanejada` com `duracao_min` preenchido e
`reps_alvo = 0`, `peso_kg = 0`. Nada de progressão automática: cardio não
tem carga que suba sozinha.

**Registro.** Confirmar um item de cardio grava em `activity_sessions` — a
tabela que o balanço energético e a análise já leem — e o elo é
`session_plan_sets.activity_id`. Nada de cardio entra em `workout_sets`: lá é
onde vive levantamento de peso, e contaminar aquela tabela quebraria volume,
1RM e progressão de uma vez.

As calorias saem de `estimativaKcal(met, peso_kg, duracao_min)`, que já existe
em `domain/treino.ts`, com o peso vindo do perfil. Sem perfil, o app pede a
duração e grava kcal 0 em vez de inventar um número.

**Tela da sessão.** Um item de cardio é uma linha única: nome, duração alvo,
kcal estimada. Tocar registra. O sheet de ajuste, para cardio, mostra duração e
kcal no lugar de reps, peso, tipo e RIR.

**Tela da rotina.** O sheet de prescrição ganha "Cardio" como quarto tipo, com
dois campos: atividade (do catálogo de cardio) e duração.

### Onde foi parar o registro avulso

O botão "Adicionar exercício" da sessão já busca no catálogo inteiro, então
buscar "bike" no meio do treino passa a funcionar sem nada novo. Um dia só de
cardio é "Treinar mesmo assim" no hub e adicionar a bike — o mesmo caminho de
qualquer treino fora da rotina. É isso que substitui `/treino/cardio`.

---

## Parte 3 — `/treino/progresso`

Uma tela, três visões num `Segmented`. Nenhuma delas começa vazia.

### Visão "Sessões"

Lista cronológica. Cada card: nome do treino, data relativa, e um resumo
honesto — `N séries · X kg de volume · Y min`. Uma sessão em que só houve
aquecimento diz **"só aquecimento"** em vez de não dizer nada (B3). Uma sessão
sem nenhuma série registrada diz "nenhuma série registrada".

Tocar abre `/treino/sessao/:id`.

### Visão "Exercícios"

Lista dos exercícios com histórico, do mais recente para o mais antigo. Cada
linha: nome, última carga (`3×10 @ 40 kg`), e a melhor marca. Tocar expande, na
própria linha, o gráfico de progressão com um `Segmented` de métrica — **1RM
estimado · carga máxima · volume** — e, quando o exercício é de 5/3/1, os
recordes de repetições por peso.

Isso mata o `<select>` (B6) e a tela vazia (B7) de uma vez: a lista **é** o
conteúdo, e ela nunca está vazia se você já treinou.

### Visão "Resumo"

Duas perguntas que hoje nenhuma tela responde:

**Estou seguindo a rotina?** Treinos por semana nas últimas quatro semanas
contra quantos dias a rotina pede, e, por dia da rotina, há quantos dias ele
não é feito — "Perna: 11 dias". É o número que denuncia o dia que você vem
pulando.

**Estou treinando tudo?** Séries por grupo muscular na semana, em barras.
`volumePorGrupo` já existe em `domain/analise-treino.ts` e é reaproveitada.

---

## Parte 4 — `/treino/sessao/:id`, o detalhe

O que a rodada anterior tornou possível e não usou: o plano guarda o
**prescrito** e `workout_sets` guarda o **realizado**, ligados por `set_id`.
Esta tela mostra os dois lado a lado.

Por exercício, uma linha por série: `12 × 40 kg` prescrito, `10 × 40 kg` feito,
com a diferença marcada quando houver. Séries não feitas aparecem apagadas —
elas são parte do que aconteceu naquele dia.

Tocar numa série abre o mesmo `SheetAjustarSerie` da academia, agora corrigindo
o passado: errou a carga de pé na academia, conserta aqui. Também dá para
apagar a sessão inteira.

Sessões antigas, anteriores a esta arquitetura, não têm plano — a tela mostra
só o realizado, sem a coluna de prescrito, sem fingir que sabe o que era para
ser.

---

## Parte 5 — Ajustes fora do módulo

**Dashboard (B9).** O card de treino do dashboard passa a refletir o mesmo
estado do hub: com sessão em andamento, mostra o progresso e leva para ela.
Duas telas contando a mesma história sobre o mesmo estado.

**`/mais`.** Ganha a entrada "Exercícios", que saiu do treino.

---

## Parte 6 — Camadas

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/prescricao.ts` | Ganha a estratégia `cardio`. |
| `src/domain/consistencia.ts` | **Novo, puro.** Treinos por semana, e dias desde a última vez de cada dia da rotina. |
| `src/domain/analise-treino.ts` | Intocado; `volumePorGrupo` é reaproveitada. |
| `src/repositories/sessao.ts` | Registro e desfazer de item de cardio; leitura do detalhe de uma sessão. |
| `src/repositories/progresso.ts` | **Novo.** Exercícios com histórico e suas melhores marcas; séries por grupo no período. |
| `src/db/seed-cardio.ts` | **Novo.** Seed dos exercícios de cardio a partir de `activity_types`. |
| `src/pages/treino-progresso.tsx` | A tela de três visões. |
| `src/pages/treino-sessao-detalhe.tsx` | O detalhe de uma sessão passada. |

Saem: `src/pages/treino-historico.tsx`, `src/pages/treino-progressao.tsx`,
`src/pages/treino-cardio.tsx`, `src/components/treino/cardio-tab.tsx`,
`src/components/treino/progressao-tab.tsx` e seus testes.
`src/pages/treino-exercicios.tsx` vira `src/pages/exercicios.tsx`.

---

## Parte 7 — Testes

| Camada | O que cobre |
|---|---|
| `domain/prescricao` | Estratégia cardio: uma série, duração preenchida, sem progressão de carga |
| `domain/consistencia` | Treinos por semana; dias desde a última vez; rotina vazia; dia nunca feito |
| `repositories/sessao` | Registrar cardio grava em `activity_sessions` e **não** em `workout_sets`; desfazer apaga a atividade; detalhe devolve prescrito e realizado juntos |
| `repositories/progresso` | Exercícios com histórico em ordem de recência; melhor marca; séries por grupo no período; isolamento por usuário |
| Componentes | As três visões de `/treino/progresso`; detalhe com prescrito × realizado; sessão antiga sem plano; corrigir uma série pelo detalhe; item de cardio na sessão |
| Ao vivo | Playwright: montar rotina com cardio → treinar → conferir kcal em `activity_sessions` e no balanço energético |

O critério de aceite do cardio é o balanço energético: 30 minutos de bicicleta
registrados dentro de uma sessão de treino têm que aparecer em `/analise` com
as mesmas calorias que a tela de cardio antiga produzia.
