# Achados do teste manual — 2026-08-31

Varredura do módulo de **treino** e das **substituições do plano** num Chromium
headless (Playwright), viewport de celular (420×900), usuário isolado
`claude-qa@local.test` com uma cópia do plano de cutting. Servidores locais:
`turso dev` em 8090, Vite em 5174.

**Zero erros de console e zero requisições falhas.** Todos os achados são de
comportamento, de modelo de dados ou de tela — nenhuma exceção.

Numeração estável — o desenho de correção referencia estes números.

---

## Substituições do plano alimentar

### S1 · Só dá para trocar UM item da refeição — **alta**

A causa é o modelo: `plan_checks` tem **uma coluna `swap_id`**. O banco só sabe
guardar uma troca por refeição por dia.

Reproduzido: o Café da Manhã tem cinco itens (proteína, carboidrato, gordura,
fruta, café) e a folha lista as **12 substituições** previstas para o bloco,
agrupadas por categoria. Tocar em "Tapioca" grava aquela troca **e marca a
refeição inteira como feita** — a folha fecha e não há segundo toque possível.

Trocar a refeição toda, que é o que se quer quando o plano prevê alternativa
para cada linha, é impossível por construção.

### S2 · Escolhida a troca, o botão "Trocar" desaparece — **alta**

`bloco-card.tsx:183` condiciona o botão a `!feito`. Como escolher uma troca
marca `feito`, o caminho se fecha atrás de você: para trocar de novo é preciso
desmarcar a refeição inteira.

### S3 · "Trocar" só existe no bloco dentro da janela de horário — **alta**

O botão vive dentro de `{aberto && ...}`, e `aberto` é `agora || atrasado`. Às
9h da manhã, o único bloco que oferece "Trocar" é o Café da Manhã. Planejar a
troca do almoço antes do almoço não é possível.

Medido no navegador: **1** botão "Trocar" na tela inteira, com quatro refeições
no plano.

### S4 · A troca escolhida não deixa rastro nenhum — **média**

Depois de escolher "Tapioca", o card volta a mostrar `Café da Manhã · ~400
kcal`. Não diz o que foi trocado, nem por quê, nem quanto vale. O dado está no
banco (`plan_checks.swap_id`) e nenhuma tela o lê.

### S5 · Nada permite trocar por algo fora da lista do plano — **média**

Por desenho, hoje: "o app não inventa substituição". Mas a vida acontece — e
sem escape a pessoa simplesmente não marca a refeição, e o app perde o dia.

### S6 · `trocasPara` é código órfão — **baixa**

`src/domain/plano-dia.ts:117` implementa troca **por item, por categoria** —
exatamente o que S1 pede. Está testada e **nenhuma tela a chama**. O desenho
certo foi pensado; só a versão "bloco inteiro" foi ligada.

### S7 · "Comi" nunca cumpriu o que o schema promete — **média**

O comentário de `plan_items` em `src/db/schema.sql:259` diz:

> `food_id`/`qty_g` são o enriquecimento que permite o botão "Comi" gravar
> entries reais; sem eles o bloco ainda marca como feito e credita `kcal_alvo`.

Nem uma coisa nem outra existe. `marcarBloco` só escreve em `plan_checks`, e o
consumo do dia vem exclusivamente de `food_entries`. Marcar as quatro refeições
do plano deixa o balanço energético em **0 kcal**.

---

## Treino

### T1 · Treino avulso vazio vira sessão órfã, e cada tentativa vaza outra — **alta**

`repositories/sessao.ts:401`:

```sql
FROM workout_sessions s
JOIN session_plan_sets p ON p.session_id = s.id   -- INNER JOIN
```

Uma sessão sem nenhuma linha de plano **não existe** para a consulta. Como
"Treinar mesmo assim" cria a sessão vazia e só depois você adiciona exercício,
a janela entre as duas coisas é um buraco.

Reproduzido: "Treinar mesmo assim" → sessão 18, tela vazia. Voltei para
`/treino` → o hub **não** oferece "Retomar"; `/treino/sessao` diz "Nenhum treino
em andamento". Toquei de novo → **sessão 19**, outra vazia. A 18 ficou órfã.

No banco do usuário isso já aconteceu: sessões **14 e 15** de 19/08, ambas
"Treino livre", a 14 com zero exercícios, abertas desde então.

### T2 · Treino avulso só existe em dia de descanso — **alta**

"Treinar mesmo assim" está dentro do ramo `dia === null` de `pages/treino.tsx`.
Num dia que tem rotina não há caminho nenhum para um treino extra — e enquanto
uma sessão está aberta o card oferece **só** "Retomar treino".

Somado a T1, é isto que produz "não consigo cadastrar mais de um treino
avulso".

### T3 · Não dá para adicionar exercício a um treino já criado — **alta**

`pages/treino-sessao-detalhe.tsx` tem trocar, mover, remover, +série, −série,
editar nome/data e excluir. **Não tem "Adicionar exercício".** Confirmado no
navegador nas sessões 16 (com plano) e 18 (vazia).

Pior no caso vazio: `plano.length === 0 && sets.length === 0` cai em "Sessão sem
registro" com **um único botão: excluir**. A sessão de T1 é irrecuperável.

### T4 · O primeiro descanso nasce parado em produção — **alta**

`components/treino/cronometro-descanso.tsx:33`:

```js
if (primeira.current) { primeira.current = false; return; }
```

O componente só monta **depois** da 1ª série (`{registros > 0 && <Cronometro…>}`
em `treino-sessao.tsx`), então essa guarda cai justamente no primeiro descanso.

Em desenvolvimento o StrictMode roda o efeito duas vezes e mascara — no
navegador o cronômetro contou normal (1:29 → 1:25 em 4 s). **Em produção o
efeito roda uma vez: o primeiro descanso fica congelado em 1:30** até alguém
tocar no play.

**Confirmado no bundle de produção, não só deduzido.** Com o código original
(componente + a montagem condicional `{registros > 0 && …}`, que é o par que
produz o defeito), `npm run build` + `vite preview`: `1:30 → 1:30` depois de
cinco segundos. Com a correção, no mesmo build: `1:29 → 1:24`.

### T5 · O cronômetro não sobrevive a sair da tela — **média**

O estado é local ao componente e `registros` reseta a cada montagem. Sair da
sessão e voltar apaga o descanso em curso. O README promete "a sessão sobrevive
a fechar o app" — a sessão sim, o descanso não.

### T6 · O cronômetro não avisa quando zera, e não abre antes da 1ª série — **média**

Sem som, sem vibração. E não há como iniciar um descanso por conta própria
(entre aquecimentos, por exemplo) porque o componente nem existe até a primeira
série entrar.

### T7 · Cardio adicionado na rotina nasce como musculação — **alta**

`pages/treino-rotina.tsx:34` usa `prescricao: "dupla"` fixo para qualquer
exercício do catálogo. Adicionei **Corrida** na quarta-feira e a rotina gravou
**"3 × 8–12"** — três séries de 8 a 12 repetições de corrida, a 0 kg.

O outro caminho acerta: `montarItemAvulso` (`repositories/sessao.ts:305`) olha
`equipamento === "cardio"` e produz "30 min · ≈402 kcal". As duas portas do
mesmo exercício discordam.

### T8 · `criarRotina` não desativa as rotinas anteriores — **baixa**

`repositories/rotina.ts:105` insere com `ativa=1` sem zerar as outras. Uma
segunda rotina deixa duas ativas; quem ganha é o `ORDER BY id DESC` de
`getRotinaAtiva`. `ativarPlano` do plano alimentar faz o par certo — a rotina
não.

### T9 · Sessão antiga só com `workout_sets` não tem edição — **informativo**

O ramo `SemPlano` mostra o realizado e nada mais. É coerente com o texto da
tela ("o app não sabe o que era para ser") e fica como está.

---

## Calistenia

### C1 · O módulo ocupa tela demais para o que entrega — **média**

`CardCalisteniaHoje` é um card inteiro — cabeçalho, estado vazio com dois
parágrafos, lista de totais e uma faixa de chips — renderizado **duas vezes**:
no dashboard e na aba "Hoje" do treino. Num dia sem série registrada, os dois
mostram o mesmo convite de três linhas para algo que talvez nem aconteça hoje.

O `TreinoLayout` documentava a escolha: *"a calistenia é o aprofundamento do
card que vive em Hoje, não uma quinta aba"*. Na prática o card virou o que mais
ocupa espaço nas duas telas onde aparece.

**Correção:** a calistenia vira a **quinta aba** do treino. O card sai da aba
"Hoje" (ela tem aba própria agora) e, no dashboard, vira uma linha ao lado da
linha do treino — resumo do dia e um `+` de 44px, que preserva o registro em
dois toques.
