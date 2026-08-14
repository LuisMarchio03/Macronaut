# Plano de dieta guiado + redesign da interface

**Data:** 2026-08-14
**Status:** aprovado

## Problema

O Macronaut hoje é um **diário de registro**: o usuário abre o app, procura a
refeição, procura o alimento e digita a quantidade. O app nunca diz o que fazer.
Quem segue um plano de dieta escrito por um profissional precisa manter a
planilha aberta ao lado e traduzir mentalmente "planilha → app" quatro vezes por
dia.

Além disso a interface acumula ruído — grade de fundo, scanlines, brackets de
canto, painéis de vidro, caixa-alta monoespaçada em todo label — que compete com
o dado e torna a leitura lenta no celular.

## Objetivo

1. O usuário importa a planilha do plano e o app passa a **guiar o dia**: qual
   refeição é a próxima, o que comer nela, quanto de água em cada período,
   quando tomar o suplemento — e registra tudo com um toque.
2. Qualquer pessoa baixa um **template**, preenche com a dieta dela e importa.
3. A interface fica **legível e rápida**: menos enfeite, mais dado, menos toques.

## Não-objetivos

- Editor visual de plano dentro do app (a planilha é a fonte de verdade nesta
  rodada; edição pontual de bloco vem depois).
- Múltiplos planos ativos simultâneos ou periodização por dia da semana.
- Cálculo automático de macros a partir do texto livre dos itens do plano — os
  macros vêm da aba `Macros`, preenchida por quem escreveu o plano.
- Sincronização/compartilhamento de planos entre usuários.

---

## Parte 1 — Modelo de dados

O plano é **descritivo**, não normativo: ele descreve o que comer, e o diário
(`food_entries`) continua sendo o registro do que foi comido. As duas coisas se
conectam por `plan_checks`.

### Tabelas novas

```sql
CREATE TABLE diet_plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  nome         TEXT NOT NULL,
  origem       TEXT NOT NULL,          -- 'xlsx' | 'csv' | 'manual'
  kcal_min     REAL,                   -- "Meta Calórica Diária: 1700-2000"
  kcal_max     REAL,
  prot_alvo_g  REAL,                   -- "Meta Proteína: ~150g"
  agua_ml_alvo REAL,                   -- "Meta Água: 3L/dia"
  ativo        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL
);
```

Só um plano `ativo = 1` por usuário. Importar um novo desativa o anterior sem
apagá-lo — o histórico de `plan_checks` continua fazendo sentido.

```sql
CREATE TABLE plan_blocks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id      INTEGER NOT NULL,
  tipo         TEXT NOT NULL,          -- 'refeicao' | 'agua' | 'suplemento'
  nome         TEXT NOT NULL,
  hora_inicio  TEXT,                   -- 'HH:MM' | NULL (bloco ancorado)
  hora_fim     TEXT,
  ancora       TEXT,                   -- 'Após almoço' quando não há horário
  kcal_alvo    REAL,
  ml_alvo      REAL,
  observacao   TEXT,
  ordem        INTEGER NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE
);
```

Um só tipo de tabela para os três tipos de bloco, porque o que a tela precisa é
uma **linha do tempo única e ordenada**. Separar em três tabelas obrigaria a
mesclar e reordenar na leitura, todo render.

```sql
CREATE TABLE plan_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id   INTEGER NOT NULL,
  texto      TEXT NOT NULL,            -- '3 ovos mexidos com espinafre e tomate'
  categoria  TEXT,                     -- 'proteina'|'carboidrato'|'fruta'|'gordura'|'vegetal'|NULL
  food_id    INTEGER,                  -- casamento opcional com o catálogo
  qty_g      REAL,                     -- só quando food_id resolvido
  ordem      INTEGER NOT NULL,
  FOREIGN KEY (block_id) REFERENCES plan_blocks (id) ON DELETE CASCADE,
  FOREIGN KEY (food_id)  REFERENCES foods (id) ON DELETE SET NULL
);
```

`texto` é sempre preenchido e é o que a tela mostra. `food_id`/`qty_g` são o
enriquecimento que permite o botão **Comi** gravar entries reais. Item sem
`food_id` ainda funciona: marca o bloco como feito e credita `kcal_alvo`
rateado.

```sql
CREATE TABLE plan_macros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  block_nome TEXT NOT NULL,            -- casa com plan_blocks.nome
  prot_g     REAL NOT NULL,
  carb_g     REAL NOT NULL,
  gord_g     REAL NOT NULL,
  kcal       REAL NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE
);

CREATE TABLE plan_swaps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL,
  block_nome TEXT NOT NULL,
  categoria  TEXT NOT NULL,
  alimento   TEXT NOT NULL,
  porcao     TEXT NOT NULL,            -- '3 unidades (150g)'
  qty_g      REAL,                     -- extraído de porcao quando possível
  kcal       REAL NOT NULL,
  food_id    INTEGER,
  FOREIGN KEY (plan_id) REFERENCES diet_plans (id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods (id) ON DELETE SET NULL
);
```

`plan_macros` e `plan_swaps` referenciam o bloco por **nome**, não por id: nas
abas `Macros` e `Substituicoes` a chave que o usuário digita é o nome da
refeição. Casar por nome mantém a planilha como o contrato e evita exigir que as
três abas estejam perfeitamente sincronizadas em ordem.

```sql
CREATE TABLE plan_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  plan_id    INTEGER NOT NULL,
  data       TEXT NOT NULL,            -- 'YYYY-MM-DD'
  block_id   INTEGER NOT NULL,
  feito      INTEGER NOT NULL DEFAULT 1,
  swap_id    INTEGER,                  -- trocou por uma substituição?
  created_at TEXT NOT NULL,
  UNIQUE (user_id, data, block_id),
  FOREIGN KEY (block_id) REFERENCES plan_blocks (id) ON DELETE CASCADE,
  FOREIGN KEY (swap_id)  REFERENCES plan_swaps (id) ON DELETE SET NULL
);
```

### Coluna aditiva

`water_log.block_id INTEGER` — para creditar o copo ao período correto do plano.
Sem ela, água registrada às 22h contaria no bloco da manhã se a gente inferisse
período pelo `created_at`. Entra em `ADDITIVE_COLUMNS` (`scripts/lib/apply-schema.ts`),
não em `schema.sql`, pelo mesmo motivo já documentado lá.

### Compatibilidade

Todas as tabelas são novas e a única alteração em tabela existente é uma coluna
aditiva anulável. **Nenhuma migração destrutiva.** Um banco em produção
sobrevive a `npm run db:setup` sem perder dado.

---

## Parte 2 — Import da planilha

### Fluxo

```
arquivo (.xlsx | .csv)
  → parseWorkbook      normaliza para { plano: Cell[][], macros: Cell[][], subs: Cell[][] }
  → parsePlano         → { meta, blocks[] }
  → parseMacros        → PlanMacroRow[]
  → parseSubs          → PlanSwapRow[]
  → validarPlano       → { erros: Erro[], avisos: Aviso[] }
  → [PREVIEW na tela]  usuário confere e confirma
  → importarPlano(db)  transação: desativa plano anterior, grava o novo
```

`parseWorkbook` é a **única** função que conhece o formato do arquivo. Tudo
depois dela opera sobre matriz de células. Isso mantém os parsers puros e
testáveis sem tocar em xlsx, e permite adicionar formatos novos depois sem mexer
na lógica.

### Regras de parsing — derivadas do arquivo real

**Cabeçalho (aba `Plano`, antes da linha de header):**

| Padrão na planilha              | Vira                        |
|---------------------------------|-----------------------------|
| `PLANO DE CUTTING - LUÍS GABRIEL` | `diet_plans.nome`         |
| `Meta Calórica Diária: 1700-2000 kcal` | `kcal_min=1700`, `kcal_max=2000` |
| `Meta Calórica Diária: 1800 kcal` | `kcal_min = kcal_max = 1800` |
| `Meta Proteína: ~150g`          | `prot_alvo_g = 150`         |
| `Meta Água: 3L/dia`             | `agua_ml_alvo = 3000`       |

**Linha de header:** localizada procurando a primeira linha cuja coluna A
normalizada (sem acento, minúscula) seja `refeicao`. As colunas são mapeadas por
nome, não por posição — `REFEIÇÃO`, `HORÁRIO`, `ALIMENTOS`, `CALORIAS`,
`OBSERVAÇÕES`. Ordem diferente ou coluna extra não quebra.

**Corpo:**

- Coluna `REFEIÇÃO` preenchida → **abre um bloco novo**.
- Coluna `REFEIÇÃO` vazia e `ALIMENTOS` preenchida → **item do bloco anterior**.
  (É como a planilha do usuário representa os 4-5 alimentos de cada refeição.)
- Linha inteiramente vazia → separador, ignorada.

**Tipo do bloco**, por precedência:

1. Nome contém `💧` ou começa com `ÁGUA`/`AGUA`/`HIDRATAÇÃO` → `agua`
2. Nome contém `🥤` ou bate com `CREATINA|SUPLEMENTO|WHEY|CAFEÍNA|ÔMEGA|OMEGA|VITAMINA` → `suplemento`
3. Caso contrário → `refeicao`

**Linhas de resumo** (`TOTAL ESTIMADO`, `TOTAL DIÁRIO`, `HIDRATAÇÃO TOTAL`) não
viram bloco. Viram **validação**: se `TOTAL ESTIMADO` divergir da soma dos
`kcal_alvo` em mais de 15%, gera um aviso (não um erro).

**Normalizações de valor:**

| Campo      | Entrada                        | Saída                              |
|------------|--------------------------------|------------------------------------|
| `HORÁRIO`  | `7h00 - 8h00`                  | `07:00` / `08:00`                  |
| `HORÁRIO`  | `12h00-13h00`, `7:00 às 8:00`  | idem (separador ` - `, `-`, `às`)  |
| `HORÁRIO`  | `Após almoço`                  | `ancora='Após almoço'`, horas NULL |
| `CALORIAS` | `~400 kcal`, `400kcal`, `400`  | `400`                              |
| `CALORIAS` | `1600-1800 kcal`               | média `1700` + aviso               |
| água       | `750ml (3-4 copos de 200ml)`   | `ml_alvo = 750`                    |
| água       | `1L`, `1,5 litros`             | `1000`, `1500`                     |

**Categoria do item** (para casar com as substituições): inferida por palavra-chave
do texto — `ovo|frango|peixe|atum|iogurte|queijo|carne|patinho` → `proteina`;
`arroz|batata|pão|aveia|tapioca|macarrão|feijão|lentilha|grão` → `carboidrato`;
`fruta|banana|maçã|mamão|abacaxi` → `fruta`; `azeite|pasta de amendoim|castanha|semente|chia|linhaça` → `gordura`;
`salada|brócolis|couve|espinafre|abobrinha|chuchu|cenoura|vegetais` → `vegetal`.
Sem match → `NULL` (o item aparece normal, só não oferece troca).

**`OU` no item:** `3 ovos mexidos OU 2 col. sopa aveia` é guardado como um item
só, com o texto íntegro. A alternativa é apresentada na UI como escolha, mas não
vira duas linhas no banco — são a mesma posição do plano.

### Validação

**Erros** (bloqueiam o import):
- Aba `Plano` ausente ou sem linha de header reconhecível
- Nenhum bloco de refeição encontrado
- Bloco de refeição sem nenhum item

**Avisos** (import prossegue, tela mostra):
- Aba `Macros` ou `Substituicoes` ausente
- Nome em `Macros`/`Substituicoes` que não casa com nenhum bloco
- `TOTAL ESTIMADO` divergindo >15% da soma
- Horário não reconhecido (bloco vira ancorado)
- Bloco de água sem `ml_alvo` extraível

A tela de preview mostra os dois grupos e o plano parseado inteiro **antes** de
gravar. O usuário vê exatamente o que vai entrar.

### Biblioteca

`read-excel-file` (~40 KB gz, mantida, tipada) carregada com `import()`
dinâmico na tela de import — não entra no bundle inicial. O `xlsx`/SheetJS do
npm está congelado em 0.18.5 com CVE conhecido e foi descartado.

CSV é parseado por função própria (`parseCsv`), ~30 linhas, com suporte a aspas
e vírgula dentro de campo. Não justifica dependência.

---

## Parte 3 — Template baixável

Gerado em **build time** por `scripts/build-template.ts` usando
`write-excel-file/node` → `public/template-macronaut.xlsx`. A dependência é
`devDependency`; **nada de escrita de xlsx vai para o cliente**.

Abas do template:

1. **Instruções** — como preencher, o que cada coluna significa, os formatos
   aceitos de horário/caloria/água, e a regra "deixe REFEIÇÃO em branco para
   continuar a anterior".
2. **Plano** — cabeçalho de metas + header + um exemplo de dia curto (2
   refeições, 1 bloco de água, 1 suplemento) para servir de molde.
3. **Macros** — header + as linhas do exemplo.
4. **Substituicoes** — header + algumas linhas do exemplo.

Também `public/template-plano.csv`, `template-macros.csv`,
`template-substituicoes.csv`, gerados pelo mesmo script.

A tela de import expõe os dois: **Baixar template (.xlsx)** e **Baixar CSVs**.

---

## Parte 4 — Telas

### Hoje (`/`) — o trilho

Substitui o dashboard atual. Ordem vertical:

1. **Cabeçalho** — `Quinta, 14 de agosto` + navegação de data discreta. Uma
   única leitura da data (hoje há duas).
2. **Resumo de energia** — número grande de kcal consumidas, meta, barra de
   progresso e os três macros em linha. Sem repetir o mesmo número em card
   separado logo abaixo.
3. **Aderência** — `3 de 4 refeições` + pontos. É a métrica que o plano
   introduz e a que responde "estou seguindo?".
4. **Linha do tempo do dia** — os `plan_blocks` em ordem, cada um com estado:
   - `feito` — check, texto atenuado, colapsado
   - `agora` — dentro da janela de horário; card expandido, destacado
   - `proximo` — ainda vai acontecer; colapsado
   - `atrasado` — janela passou e não foi marcado; marcador de atenção discreto
   
   Bloco de **refeição** expandido mostra os itens e duas ações: **Comi**
   (grava e marca) e **Trocar** (abre as substituições da refeição, agrupadas
   por categoria; escolher uma troca o item e recalcula kcal).
   
   Bloco de **água** mostra progresso do período (`600 / 1000 ml`) e botões
   `+200` / `+500`, gravando com `block_id`.
   
   Bloco de **suplemento** é um check simples com a observação do plano.

Sem plano importado, a tela cai no modo diário atual com um convite para
importar — o app não fica inútil para quem não usa plano.

### Plano (`/plano`)

Ver o plano ativo por completo, a tabela de substituições, a tabela de macros.
Ações: **Importar planilha**, **Baixar template**, **Trocar de plano**.

### Import (`/plano/importar`)

Passo 1: escolher arquivo (drag & drop + input). Passo 2: preview com erros e
avisos. Passo 3: confirmar.

### Nutrição (`/nutricao`)

Continua sendo o diário livre e o lugar de registro detalhado. Ganha, em cada
refeição, a comparação `planejado × registrado` quando há plano.

### Navegação

Cinco destinos: **Hoje · Nutrição · Treino · Análise · Mais**, com `/plano`
dentro de Mais. Um botão de ação primária (registro rápido) fica acessível a
partir de Hoje e Nutrição — hoje registrar exige quatro toques a partir da home.

---

## Parte 5 — Design system

### O que sai

Grade de fundo, scanlines, brackets de canto, `backdrop-filter` nos painéis,
`text-transform: uppercase` + `letter-spacing` largo + mono nos labels de texto.
Todos são custo de leitura sem retorno de informação.

### O que entra

**Tipografia** — quatro níveis e só:

| Papel     | Tamanho / peso | Uso                             |
|-----------|----------------|---------------------------------|
| `display` | 32 / 700       | número principal (kcal do dia)  |
| `title`   | 20 / 600       | título de tela                  |
| `body`    | 15 / 400       | texto corrido, itens            |
| `caption` | 13 / 400       | rótulo, unidade, meta           |

Mono (`font-variant-numeric: tabular-nums`) **apenas** em número que alinha em
coluna. Nunca em label de texto.

**Cor** — neutros + um destaque + três de macro. Todos os pares
texto/fundo verificados em contraste WCAG AA (4.5:1 para texto, 3:1 para
elemento gráfico), nos dois temas. Cor carrega informação (macro, estado do
bloco, alerta), nunca decoração.

**Espaço** — escala de 4px. Gutter da página 16, gap entre cards 12, padding
interno de card 16. Alvo de toque mínimo 44×44.

**Superfície** — card = `background` + borda 1px + raio 16. Sombra só onde há
elevação real (sheet, nav). Sem vidro.

**Estados** — toda lista tem loading (skeleton com a forma do conteúdo), vazio
(com a ação que resolve) e erro (com retry). Hoje várias telas só têm o caminho
feliz.

**Tema claro** de verdade, não o escuro com fundo trocado.

### Bugs corrigidos junto

- `dashboard.tsx` — `pctAgua` renderizado como `41.66666666666667%`
- `macro-bars.tsx` — label e valor colidem (`CARBOIDRATO47 / 160 g`)
- `dashboard.tsx` — data no `<h1>` e no `DateNav` logo abaixo, duplicada
- `.env.local.bak.1783679308` versionado no repositório

---

## Parte 6 — Testes

| Camada        | Como                                                          |
|---------------|---------------------------------------------------------------|
| Parsers       | Vitest, fixtures extraídas do arquivo real do usuário + casos malformados (header ausente, horário inválido, bloco sem item, aba faltando) |
| Repositories  | Vitest contra libSQL em memória — padrão já usado no projeto   |
| Componentes   | Testing Library — estados do bloco, ação Comi, ação Trocar     |
| Ao vivo       | Playwright contra `vite dev` + `turso dev`, screenshot de cada tela em claro e escuro ao fim de cada fase |

O critério de aceite do import é objetivo: **`Plano-Cutting-Completo-ATUALIZADO.xlsx`
importa sem erro e sem edição**, produzindo 4 blocos de refeição, 4 de água, 1 de
suplemento, 20 itens, 4 linhas de macro (a de total não conta) e 39
substituições.

---

## Fases

1. **Fundação** — design system, navegação, os quatro bugs acima.
2. **Plano** — schema, parsers, repositories, hooks, import com preview,
   template, tela Hoje.
3. **Polimento** — Nutrição, Treino, Análise, Ajustes, Mais, IA, Login,
   Onboarding no padrão novo; README.

Cada fase termina com suíte verde e screenshots ao vivo.
