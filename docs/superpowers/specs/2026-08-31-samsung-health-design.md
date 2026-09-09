# Samsung Health no Macronaut — desenho

## O que a investigação achou

Não existe API web nem REST pública da Samsung. O Samsung Health se deixa ler
por duas portas, as duas **nativas do Android**:

- **Samsung Health Data SDK** — Android 10+, Java 17+, exige o app Samsung
  Health 6.30.2+. Sem web, sem JavaScript, sem REST. O SDK anterior foi
  descontinuado em 31/07/2025. Ler em modo desenvolvedor dispensa parceria;
  distribuir, não.
- **Health Connect** — o Samsung Health escreve nele, e outros apps leem daí.
  API de sistema do Android.

Os intermediários pagos (Terra, Thryve, Open Wearables) também rodam um SDK
Android no aparelho. O navegador nunca é o cliente.

**A opção "TWA + ponte JavaScript" não existe.** Uma TWA é o Chrome
renderizando o site: não suporta `postMessage` nem `addJavascriptInterface`.
Ponte JS existe em `WebView`, que custaria o PWA e é o padrão que a própria
documentação do Android trata como risco.

## A forma que sobra, e que este desenho adota

**TWA para distribuição + serviço nativo companheiro no mesmo APK.** O serviço
lê o Health Connect e manda para o backend do Macronaut; o app web lê o próprio
banco, como sempre fez. Os dados não atravessam a fronteira da TWA — ela existe
só para o app estar na loja e abrir como aplicativo.

Isso obriga o Macronaut a ter um backend de verdade, porque hoje o navegador
fala direto com o Turso com o token no cliente. Com um APK público, esse token
estaria dentro de um binário distribuído. O proxy serverless deixou de ser
roadmap e virou pré-requisito.

---

## Fase 1 — o backend (esta entrega)

### O proxy do banco

O login parou de devolver a credencial do Turso. Devolve um **bilhete
assinado** (HMAC-SHA256, `AUTH_SECRET`) que diz "sou o usuário 3, até tal hora,
para tal finalidade". O app monta um cliente que fala com `/api/db`, e é o
servidor que conhece o banco.

Coube num arquivo por causa da forma que já existia: os repositórios recebem
`db: Client` e usam só `execute` e `batch`. `criarBancoRemoto` implementa essa
superfície sobre `fetch`, e os 422 `db.execute` do app não mudaram uma linha.

**O que isso resolve:** a credencial do banco não sai do servidor; a sessão
expira em 30 dias; dá para revogar.

**O que isso NÃO resolve, e está dito no código:** o SQL continua vindo do
cliente. Uma sessão válida roda qualquer consulta no banco daquele usuário — o
mesmo poder que a tela já tem. A defesa seria mover os repositórios para o
servidor, um endpoint por operação; é uma reescrita de outra ordem.

### Os dois escopos de token

| | `sessao` | `dispositivo` |
|---|---|---|
| Quem carrega | navegador | APK |
| Vale em | `/api/db`, `/api/codigo` | `/api/ingest` |
| Expira | 30 dias | nunca, por tempo |
| Revoga | logout / prazo | apagar o aparelho |

O celular **não** usa `/api/db`. Um token dentro de um APK distribuído, que não
expira e roda SQL arbitrário, seria pior do que o problema original. Ele fala
com `/api/ingest`, que é tipado: ele diz "corri 30 minutos", e o servidor
decide o que isso vira no banco.

O token de dispositivo não expira por tempo de propósito — um worker que roda
de madrugada não tem como pedir a senha de novo, e um token que morre sozinho
viraria "parou de sincronizar" sem pista. O que o segura é a revogação, e por
isso **toda** chamada a `/api/ingest` confere se o dispositivo ainda existe.

### Pareamento

Código de oito caracteres, cinco minutos, uma vez só. O alfabeto exclui `I`,
`O`, `0` e `1` — são os que se erra ao digitar. O banco guarda o **hash**: o
código é curto o bastante para ser digitado, logo curto o bastante para ser
adivinhado, e um vazamento da tabela não pode entregar códigos vivos.

Gerar um novo invalida o anterior: a tela mostra um código, e três antigos
ainda válidos seriam três portas que ninguém vê.

### Deduplicação

`activity_sessions` ganhou `origem` + `origem_id`, com índice único parcial. O
worker manda a mesma janela de dias toda vez; sem isso, cada sincronização
somaria a mesma corrida de novo no balanço energético.

A gravação apaga-e-insere por `(user_id, origem, origem_id)` em vez de
`ON CONFLICT`: o alvo seria um índice parcial, e casar conflito com índice
parcial no SQLite depende de a cláusula bater exatamente — dois comandos
idempotentes são mais fáceis de defender do que um upsert que funciona por
coincidência.

**O que você registrou dentro do app tem `origem` nula e nunca é tocado.** O
relógio corrige o que o relógio mandou.

### Escopo dos dados

Entram **atividade**, **peso** e **água** — os três que o app já sabe usar:
atividade alimenta o balanço energético, peso alimenta o gráfico, água conta na
hidratação do dia (e nos períodos, quando há plano).

> Correção de uma afirmação anterior deste documento: eu tinha deixado a água
> de fora dizendo que ela "precisaria de deduplicação própria". Não precisa. O
> `HydrationRecord` do Health Connect tem `metadata.id`, exatamente como a
> sessão de exercício — é a mesma deduplicação, e eu não tinha olhado.

Ficam de fora, e agora por motivos examinados:

- **nutrição** exigiria casar cada alimento com o catálogo, que é um problema
  de outra natureza (e o mesmo que faz `plan_items.food_id` estar vazio hoje);
- **passos** contariam de novo o que a caminhada registrada já contou no
  balanço energético;
- **sono** não tem lugar no app.

---

## Fase 2 — o Android (entregue, NÃO compilado)

5. Projeto Kotlin: TWA + leitura do Health Connect + worker de sincronização
   que fala com `/api/parear` e `/api/ingest`.
6. Play Console, formulário de declaração do Health Connect e revisão da
   política de dados de saúde do Google.

O projeto está em `android/`, com o passo a passo em `android/LEIA-ME.md`.

**Não dá para compilar nem testar nesta máquina:** não há `java`, `gradle`,
`adb` nem SDK, e a documentação do Samsung Health diz que **não funciona em
emulador**. O Health Connect com dados reais só existe num Galaxy físico.

O que ficou verificável daqui, e virou teste:

- `api/_lib/contrato-android.test.ts` roda o lote de exemplo do app pela
  validação real do servidor;
- `api/_lib/android-config.test.ts` prende o domínio nos três lugares que
  precisam concordar, as permissões do manifesto contra os tipos que o Kotlin
  lê, a tela de política que o Health Connect exige e o `assetlinks.json`.

O contrato que a Fase 2 cumpre:

```
POST /api/parear
  { codigo, nome, plataforma: "android" }        → { token, dispositivo }

POST /api/ingest        Authorization: Bearer <token de dispositivo>
  { origem: "health-connect",
    atividades: [{ origem_id, data, tipo, duracao_min, kcal }],
    pesos:      [{ data, peso_kg }] }            → { atividades, pesos }
```

---

## O custo que esta fase cobrava, e o que sobrou dele

Cada `db.execute` virou uma ida ao servidor, que faz outra ida ao Turso. Medido
no navegador, cinco telas somavam **46 requisições** — 16 só no dashboard.

`db-remoto.ts` passou a **juntar as leituras do mesmo tique** num `batch`. Não
é heurística de tempo: os hooks do TanStack Query disparam todos na mesma
renderização, então uma fila esvaziada num `setTimeout(0)` os pega inteiros. Uma
consulta que depende do resultado da anterior cai noutro tique e continua
sozinha — que é o certo, porque ela de fato precisa esperar.

| | requisições | comandos SQL |
|---|---|---|
| antes | 46 | 46 |
| depois | **13** | 46 |

Dashboard 16 → 3, nutrição 14 → 2. O mesmo trabalho no banco, um terço das
idas de rede. (O tempo de parede não foi medido: em `localhost` a latência é
zero, e o número que importa só aparece contra a Vercel.)

Duas coisas ficaram de fora da junção, de propósito:

- **Escrita nunca é juntada.** Um `batch` do libsql é transacional, e juntar
  escritas independentes faria uma falhar e desfazer as outras — comportamento
  que elas não tinham. O filtro é `^SELECT` sem palavra de escrita, e o lote
  sai com `modo: "read"`, que o próprio libsql recusa se algo escrever. O
  regex errar custa um erro claro, não uma escrita perdida.
- **Lote que falha é refeito uma a uma.** Antes da junção, uma consulta ruim
  derrubava só a si mesma; num lote transacional ela derrubaria as boas junto.
  A isolação não podia ser o preço da economia, e o custo do desdobramento só
  existe no caminho de erro.

O que continua em aberto é o SQL vir do cliente. A saída é a mesma que já
estava anotada: mover os repositórios para o servidor, um endpoint por
operação.
