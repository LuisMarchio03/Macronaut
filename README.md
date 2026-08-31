<div align="center">

# 🛰️ Macronaut

**Seu plano alimentar, seus macros e seus treinos — num app só.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?logo=pwa&logoColor=white)
![Testes](https://img.shields.io/badge/testes-1177%20passando-3FB950)

</div>

---

## O que é

Um **PWA** que segue o seu plano alimentar. Você importa a planilha da sua dieta
— a que o nutricionista mandou, ou uma que você mesmo montou a partir do
template — e o app passa a guiar o dia: qual é a próxima refeição, o que comer
nela, quanto de água em cada período, quando tomar o suplemento. Um toque marca
como feito; outro abre a refeição linha a linha e troca o que você não comeu —
pela substituição que o plano prevê, por um alimento do catálogo, ou pelo que
você escrever.

Além disso é um diário de nutrição e um registro de treino completos, para o que
não está no plano.

## Como funciona o plano

```
sua planilha .xlsx        →   Importar   →   o app guia o dia
├── Plano                     prévia com      ├── refeição da vez, expandida
│   Café da Manhã  7h-8h      erros e         ├── [Comi] grava e lança no diário
│   💧 ÁGUA       8h-12h      avisos          ├── [Trocar] troca item a item
│   🥤 CREATINA   após almoço                 ├── água por período (+200/+500ml)
├── Macros                                    └── aderência: 3 de 4 refeições
└── Substituicoes
```

**Não tem planilha ainda?** O app tem um botão de baixar o template (`.xlsx` com
aba de instruções, ou três `.csv`). Preencha com a sua dieta e importe.

O importador aceita o que gente escreve de verdade: `7h00 - 8h00`,
`das 12h às 13h`, `Após almoço`, `~400 kcal`, `1600-1800 kcal`,
`750ml (3-4 copos de 200ml)`, `3L/dia`. Deixar a coluna **REFEIÇÃO** em branco
continua o bloco de cima — é assim que uma refeição ganha vários alimentos.

## Funcionalidades

**Plano alimentar**
- 📥 Importação de `.xlsx` e `.csv`, com prévia antes de gravar qualquer coisa
- 📄 Template baixável, gerado no build e validado pelo próprio importador
- 🕐 Linha do tempo do dia com refeições, períodos de água e suplementos
- 🔄 **Troca por item**, não pela refeição inteira: cada linha do prato tem a
      sua substituição, e trocar todas é trocar a refeição. Vem do seu plano,
      do catálogo (com medida caseira e caloria calculada) ou do que você
      escrever — e continua disponível fora do horário e depois de marcada
- ✅ Aderência diária às refeições, e o "Comi" lança no diário o que tem
      alimento casado — o que não tem, a tela diz que não entra no balanço

**Nutrição**
- 🎯 Meta de calorias (ou faixa, quando o plano define uma) e macros
- 🍽️ Diário livre por refeição, com favoritas e "repetir"
- 📚 Catálogo folheável: tabela **TACO** e os seus, com busca que ignora
      acento — "acucar" acha "Açúcar" — e filtro por categoria
- 🏷️ Ficha do alimento com fibra, sódio e as medidas caseiras da **POF/IBGE**,
      cada uma com o peso e a caloria que ela vale
- 💧 Hidratação por período do plano, ou total do dia sem plano

**Treino**
- 🗂️ Uma tela com cinco abas: **Hoje**, **Rotina**, **Progresso**,
      **Calistenia** e **Exercícios** — as perguntas que se faz sobre treino
- 📅 Rotina por dia da semana — segunda é peito, e o app sabe disso
- 🎯 Sessão guiada: as séries já vêm com carga e reps; um toque registra
- 📈 Dupla progressão: bateu o topo da faixa em todas as séries, a carga sobe
- 🏋️ 5/3/1 disponível como prescrição de qualquer exercício da rotina
- ⏱️ Cronômetro de descanso sempre na tela: começa sozinho na série, vibra e
      bipa ao zerar, ajusta em ±15s e **sobrevive a fechar o app** — ele conta
      pelo relógio, não por um contador que morre com a aba. A sessão também
- 🆕 **Treino avulso** em qualquer dia, com nome, mesmo com outro já aberto — e
      exercício novo entra até num treino já registrado
- ➕ Exercício fora da rotina entra no meio do treino, já com a carga que o
      histórico dele manda
- 🏃 Cardio é um item do treino como qualquer outro — na rotina ou no meio da
      sessão —, com kcal estimada por MET e peso, e ajustável quando o dia foi
      mais curto que o plano
- 📈 **Progresso** numa tela só: sessões com o prescrito ao lado do realizado,
      carga por exercício ao longo do tempo, consistência contra a rotina e
      séries por grupo muscular na semana

**Calistenia**
- 🤸 Aba própria, e no dashboard uma linha só com o resumo do dia e o `+` —
      as séries soltas (flexão, agachamento, prancha) continuam a dois toques
- 🎯 Meta diária opcional por exercício, e ela nasce do que você já faz
- 📊 Volume equivalente pela fração do peso corporal, recorde de série única e
      a tendência contra a média das quatro semanas anteriores
- 🔥 A caloria estimada entra no balanço energético, ao lado do cardio — e
      **não** conta como dia de rotina na consistência do treino

**Ficha de exercício**
- 🧍 **175 exercícios** pré-cadastrados, com passo a passo da execução
- 🩻 Mapa muscular: um desenho só, acendendo o músculo que faz o trabalho e os
      que também entram — funciona offline, sem imagem de terceiro
- 🔎 Busca por apelido: "supino" acha "Supino reto com barra", "bench" também
- 🔗 "Ver execução" no Google e no YouTube, com o termo já montado
- ✍️ Os seus exercícios têm os mesmos campos — inclusive equipamento e MET,
      para cadastrar um cardio próprio

**Análise**
- 📊 Nutrição, peso e atividade por semana, mês, ano ou período escolhido
- ⚖️ Balanço energético entre o que foi ingerido e o que foi gasto

**Plataforma**
- 📲 PWA instalável, com service worker que se atualiza sozinho
- 🔐 O banco vive atrás de `/api/db`: a credencial do Turso não sai do servidor
- 📱 Aparelhos pareados por um código de cinco minutos, com token próprio que
      só serve para enviar treino e peso — e que morre quando você desconecta
- 🎨 Tema claro e escuro, seguindo o do sistema quando você não escolheu
- ♿ Paleta com contraste WCAG AA verificado **em teste**, alvos de toque de 44px

## Arquitetura

```
telas / componentes  →  hooks (TanStack Query)  →  repositories  →  Turso (libSQL)
                                  ↕
                        domain/  — lógica pura, sem framework
```

| Pasta | O que vive lá |
|---|---|
| `src/domain/` | Regra de negócio pura: parsers do plano, TMB/TDEE, macros, e1RM, kcal por MET. Testada isolada. |
| `src/domain/prescricao.ts` | Como a carga de hoje é decidida: dupla progressão, carga fixa, 5/3/1, cardio. Puro. |
| `src/domain/calistenia.ts` | A série que acontece fora da sessão: volume pela fração do peso corporal, caloria por MET, recorde e sequência de dias. Puro. |
| `src/domain/consistencia.ts` | "Estou seguindo a rotina?" — treinos por semana e dias desde a última vez. Puro. |
| `src/db/catalogo-exercicios.ts` | Os 175 exercícios com grupo, secundários, apelidos e execução. Conteúdo versionado; as invariantes dele são teste. |
| `src/components/treino/mapa-muscular.tsx` | O boneco. Um desenho para o catálogo inteiro, dirigido pelos nomes de `muscle_groups`. |
| `src/repositories/` | Todo SQL. A única camada que fala com o banco. |
| `src/hooks/` | Wrappers do TanStack Query. |
| `src/lib/planilha.ts` | A única camada que conhece o formato do arquivo importado. |
| `src/lib/db-remoto.ts` | O banco visto pelo app: mesma superfície do `Client` do libsql, sobre `fetch` para `/api/db`. Junta as leituras do mesmo tique num lote — 46 requisições viraram 13. |
| `api/_lib/tokens.ts` | Bilhetes assinados de sessão e de dispositivo, e o código de pareamento. |
| `api/_lib/ingest-core.ts` | O que o celular pode mandar, e como isso vira linha no banco sem duplicar. |
| `src/components/ui/` | Design system: `Card`, `Progress`, `Stat`, `Segmented`, `Page`… |
| `src/design/` | Verificação de contraste da paleta (roda como teste). |
| `src/db/schema.sql` | Schema completo. |
| `plan_item_swaps` | A troca de UMA linha da refeição, num dia. A chave é o item — é isso que permite trocar o prato inteiro. |

### Design system

Tokens em `oklch` no `src/index.css`. Todo par texto/fundo é verificado em
contraste WCAG AA por `src/design/palette.test.ts` — mudar uma cor sem manter o
contraste quebra a suíte de propósito. Quatro níveis tipográficos, monoespaçado
só em número que alinha em coluna, e alvos de toque de 44px (WCAG 2.5.8).

## Stack

| Camada | Escolha |
|---|---|
| UI | React 19, React Router 7 |
| Dados | TanStack Query 5 |
| Banco | Turso / libSQL, acessado direto do navegador |
| Estilo | Tailwind CSS 4, primitivos Base UI, fonte Geist |
| Planilha | `read-excel-file` (leitura, sob demanda), `write-excel-file` (build) |
| Build | Vite 8, TypeScript 6, `vite-plugin-pwa` |
| Testes | Vitest 4, Testing Library, jsdom |

## Começando

**Pré-requisito:** Node ≥ 22.

```bash
npm install

# 1. Um banco. Escolha um:
#    (a) local, sem nuvem e sem token
turso dev --db-file local.db --port 8090
#    (b) Turso na nuvem
turso db create macronaut && turso db show macronaut --url

# 2. Configure
cp .env.example .env.local
#    DB_URL=http://127.0.0.1:8090   (local)
#    DB_TOKEN=dev-local             (qualquer valor no local)

# 3. Schema + seeds (TACO, medidas POF, exercícios, tipos de atividade)
npm run db:setup

# 4. Seu usuário
npm run create-user -- --email voce@exemplo.com --senha ****

# 5. Rode
npm run dev
```

O login chama `/api/login`, que em produção é uma função serverless
(`api/login.ts`). Em desenvolvimento, `npm run dev` serve a mesma rota por um
plugin do Vite (`vite-plugin-login-dev.ts`), reaproveitando a mesma função
`authenticate` — não precisa de `vercel dev` para entrar no app.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o template, checa tipos e builda para `dist/` |
| `npm run build:template` | Só o template — e valida o resultado pelo importador |
| `npm test` | Roda a suíte inteira |
| `npm run db:setup` | Aplica o schema e os seeds |
| `npm run create-user` | Cria um usuário |
| `npm run db:limpar` | Apaga os dados de uso, preservando login e catálogos |

### Recomeçar do zero sem perder os catálogos

`npm run db:limpar` apaga o que a pessoa registrou — diário, plano, treinos,
pesagens, água, conversas com a IA — e **preserva o login**, a TACO, as medidas
da POF e os 175 exercícios do catálogo. Recriar o banco levaria minutos de seed
para jogar fora conteúdo que não é de ninguém.

Ele é **dry-run por padrão**: sem `--confirmar` só conta e mostra a tabela.

```bash
npm run db:limpar                      # relatório, não apaga nada
npm run db:limpar -- --confirmar       # executa
npm run db:limpar -- --email voce@exemplo.com --confirmar   # só um usuário
npm run db:limpar -- --confirmar --sem-refeicoes            # sem recriar as refeições padrão
```

Para outro banco que não o do `.env.local` (produção, por exemplo), passe as
variáveis na frente:

```bash
DB_URL=libsql://... DB_TOKEN=... node --experimental-strip-types scripts/limpar-dados.ts
```

A regra do que é dado de uso e o que é conteúdo mora em
`scripts/lib/limpar-dados.ts`, e é o único código do repositório que apaga em
lote — por isso tem teste próprio, que povoa todas as tabelas que a limpeza
toca e confere o que sobrou.

## Segurança — leia antes de publicar

**O token do banco não chega mais ao cliente.** O login devolve um bilhete
assinado (`AUTH_SECRET`, HMAC-SHA256) que vale 30 dias, e o app fala com
`/api/db`; quem conhece o Turso é o servidor.

O que **ainda** falta, e é honesto dizer: o SQL continua vindo do cliente. Uma
sessão válida roda qualquer consulta no banco daquele usuário — o mesmo poder
que a tela já tem, mas sem o limite de ser uma tela. A correção completa é
mover os repositórios para o servidor, um endpoint por operação.

Por isso o celular **não** usa `/api/db`: o token dele vive dentro de um APK
distribuído e não expira por tempo. Ele fala com `/api/ingest`, que é tipado —
ele diz "corri 30 minutos", e o servidor decide o que isso vira no banco.

- ✅ Use um token do Turso **restrito a este banco**.
- ✅ Defina `AUTH_SECRET` (32 bytes aleatórios) na Vercel. Sem ela o servidor
  recusa subir — um segredo com valor padrão é um segredo que ninguém troca.
- 🚧 Mantenha o deploy **privado** enquanto o SQL vier do cliente.

## Roadmap

- [x] Proxy serverless para o token do Turso
- [ ] Repositórios no servidor (um endpoint por operação), para o SQL deixar de
      vir do cliente
- [ ] App Android: TWA + Health Connect, para o Samsung Health entrar sozinho
      (o backend já está pronto — ver `docs/superpowers/specs/2026-08-31-samsung-health-design.md`)
- [ ] Edição de bloco do plano dentro do app (hoje a planilha é a fonte)
- [ ] Casamento automático dos itens do plano com o catálogo de alimentos
- [ ] Fila para as medidas caseiras da POF que esperam desambiguação
- [ ] Planos com variação por dia da semana
- [ ] Exportar / backup

## Licença

MIT — veja [LICENSE](LICENSE).
