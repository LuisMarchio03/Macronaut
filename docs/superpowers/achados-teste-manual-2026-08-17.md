# Achados do teste manual — 2026-08-17

Varredura completa da aplicação num Chromium headless (Playwright), viewport de
celular (390×844), usuário isolado `qa@local.test`. 19 rotas visitadas, ~50
interações reais: montar rotina, treinar, registrar comida e água, cardio,
metas, análise, navegação.

**Zero erros de console e zero requisições falhas em toda a aplicação.** Todos
os achados abaixo são de comportamento ou de tela, não de exceção.

Numeração estável — o plano de correção referencia estes números.

---

## Regressões e omissões da rodada de rotina (introduzidas por mim)

### A1 · `/treino/sessao` sem sessão nenhuma fica em branco para sempre — **alta**

Abrir `/treino/sessao` sem nenhuma sessão iniciada renderiza um esqueleto que
nunca sai. O estado "Nenhum treino em andamento", que existe no código, é
inalcançável.

**Causa:** no TanStack Query v5 uma consulta desabilitada permanece
`status: 'pending'`. `usePlano(undefined)` tem `enabled: false`, então
`carregandoPlano` é `true` eternamente e a guarda de carregamento nunca abre.

**Correção:** a guarda deve olhar `isFetching`/`fetchStatus`, ou simplesmente
não considerar `usePlano` quando `sessionId` é `undefined`.

### A2 · "Finalizar treino" não finaliza — **alta**

Com 12 de 12 séries registradas, tocar em "Finalizar treino" volta para
`/treino` e o hub continua dizendo **"Sessão em andamento · 12 de 12 séries ·
Retomar treino"**. Não existe estado de sessão concluída: `sessaoEmAndamento`
devolve qualquer sessão do dia que tenha plano, sem olhar se acabou.

O botão é, hoje, um "voltar" com nome de "finalizar" — e o hub nunca deixa de
oferecer um treino que já acabou.

### A3 · A série AMRAP do 5/3/1 perdeu contador e recorde — **alta**

A spec dizia: "A série AMRAP do 5/3/1 mantém o contador de repetições e o
recorde a bater, como já era." Não foi entregue. A série AMRAP é renderizada
igual às outras, com um "· máx" no canto. `useMarcasAmrap` existe, está
testado, e **não é chamado por nenhuma tela** — mesmo padrão de código órfão
que o `TreinoTab` tinha.

Sem isso, registrar a AMRAP grava as repetições *prescritas*, não as feitas —
que é justamente o número que o método existe para medir.

### A4 · Aquecimento do 5/3/1 misturado às séries de trabalho — **média**

As seis séries aparecem numa lista plana: 40%, 50%, 60%, 65%, 75%, 85%. Nada
diz que as três primeiras são aquecimento. O desenho anterior recolhia o
aquecimento num acordeão fechado — "é ritual, não decisão" — e isso se perdeu.

Consequência prática em A6 e no histórico (B3).

### A5 · O hub resume o 5/3/1 pela série de aquecimento — **média**

O card de hoje mostra **"Supino reto com barra · 6 × 5 × 32.5 kg"**. São 6
séries no total, mas `5 × 32,5 kg` é a *primeira*, que é aquecimento a 40% do
Training Max. O resumo promete um treino leve e entrega um que sobe até 67,5.

O resumo deveria descrever as séries de trabalho, não a primeira linha do array.

### A6 · Hub mostra "0 kg" para exercício sem histórico — **média**

Um exercício de dupla progressão recém-adicionado, sem peso de partida
informado, aparece como **"Crucifixo inclinado com halteres · 3 × 12 × 0 kg"**.
"0 kg" não é uma carga; é a ausência de uma. Deveria convidar a definir a carga.

### A7 · `/treino/rotina` diz "Descanso" duas vezes por dia — **baixa**

Cada dia sem treino mostra o placeholder "Descanso" dentro do campo **e** a
palavra "Descanso" logo abaixo dele. Sete dias de descanso = catorze
"Descanso" na tela.

### A8 · `/treino/rotina` abre sete campos de texto de uma vez — **média**

A tela de rotina é sete `<input>` vazios empilhados. Parece um formulário de
cadastro, não a sua semana de treino. Nomear um dia devia ser um toque, não um
campo permanentemente aberto.

### A9 · Chip de navegação da sessão sangra para fora da tela — **baixa**

"Crucifixo inclinado com halteres" não trunca e vaza pela direita na barra de
navegação entre exercícios da sessão.

### A10 · Setas de reordenar sempre visíveis e desalinhadas — **baixa**

As setas ↑↓ aparecem mesmo quando o dia tem um exercício só (ambas
desabilitadas), e o par empilhado fica mais alto que a linha de texto,
desalinhando o item.

---

## Problemas pré-existentes, anteriores a esta rodada

### B1 · Rota inexistente renderiza tela branca — **média**

`/qualquer-coisa` não casa com rota nenhuma e o app renderiza nada — nem 404,
nem redirecionamento. O React Router avisa no console
(`No routes matched location`) e a tela fica vazia.

### B2 · Troca de tema anunciada e ausente — **média**

O README promete "tema claro e escuro, seguindo o do sistema quando você não
escolheu". `ThemeToggle` está implementado em `src/lib/theme.tsx` e **não é
montado em lugar nenhum**. `/ajustes` tem conta, banco, IA e "sair" — nenhum
controle de tema. A funcionalidade só existe seguindo o sistema; escolher é
impossível.

### B3 · Histórico não mostra nada de uma sessão só de aquecimento — **média**

Uma sessão em que só séries de aquecimento foram registradas aparece no
histórico como nome + data e mais nada: sem séries, sem volume, sem exercícios.
`seriesEfetivas` filtra aquecimento (corretamente), mas a tela não tem o que
dizer quando sobra zero. Some-se A4 e o caminho para cair nesse estado é curto.

### B4 · "1 sessões" — **baixa**

O contador do cabeçalho do histórico não flexiona o singular.

### B5 · `/treino/progressao` repete o próprio título — **baixa**

"Progressão" no cabeçalho da página e "Progressão" de novo no cabeçalho do
card logo abaixo.

### B6 · `<select>` cru em progressão e cardio — **média**

As duas telas usam `<select class="select-field">` nativo, enquanto o resto do
app usa `ChipGroup`, `Segmented` e `Sheet`. Destoa do design system e o alvo de
toque não segue o padrão de 44px do resto.

### B7 · `/treino/progressao` sem exercício escolhido é uma tela vazia — **média**

Sem seleção, a tela é um card com um select e mais nada — sem estado vazio, sem
sugestão de por onde começar, sem os exercícios que têm histórico em destaque.

### B8 · Cardio: o seletor de data não afeta a lista — **média**

`/treino/cardio` tem um `DateNav` no topo. Ele decide em que data a atividade
nova é gravada, mas a lista "Atividades recentes" chama `useActivitySessions()`
sem filtro de data e mostra **todas**. Mudar o dia não muda a lista — o
controle parece quebrado.

### B9 · Dashboard não reflete sessão em andamento — **baixa**

Com uma sessão aberta, o card de treino do dashboard diz "Peito e tríceps · Ver
séries e cargas", sem o progresso nem o convite a retomar que o hub `/treino`
mostra. Duas telas contando histórias diferentes sobre o mesmo estado.

---

## O que foi verificado e está correto

- Login, sessão, `RequireAuth` e logout.
- Metas: `Calcular` derivou 2.763 kcal e os macros; `Salvar metas` só habilita
  depois, o que está certo.
- Nutrição: refeições padrão, busca TACO (11 resultados para "arroz"),
  registro de alimento com kcal no diário, registro de água.
- Cardio: estimativa por MET (30 min de bicicleta → 308 kcal) e gravação.
- Rotina: criar, nomear dia, adicionar exercício, reordenar, trocar prescrição
  para 5/3/1, voltar dia a descanso.
- Sessão: registrar por toque, desfazer, ajustar pelo sheet (reps/peso/tipo/RIR/
  nota), adicionar exercício avulso, cronômetro de descanso, retomar depois de
  sair.
- Análise: três abas e os períodos semana/mês/ano.
- Navegação inferior, todas as cinco rotas.
- Biblioteca de exercícios: 76 do catálogo, criação de exercício próprio.
