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

Entram **atividade** e **peso**: são os dois que o app já sabe usar — atividade
alimenta o balanço energético, peso alimenta o gráfico.

Ficam de fora, por ora: água e nutrição (precisariam de deduplicação própria) e
passos (contariam de novo o que a caminhada registrada já contou).

---

## Fase 2 — o Android (não entregue)

5. Projeto Kotlin: TWA + leitura do Health Connect + worker de sincronização
   que fala com `/api/parear` e `/api/ingest`.
6. Play Console, formulário de declaração do Health Connect e revisão da
   política de dados de saúde do Google.

**Não dá para construir nem testar nesta máquina:** não há `java`, `gradle`,
`adb` nem SDK, e a documentação do Samsung Health diz que **não funciona em
emulador**. O Health Connect com dados reais só existe num Galaxy físico.

O contrato que a Fase 2 precisa cumprir já está fechado e testado deste lado:

```
POST /api/parear
  { codigo, nome, plataforma: "android" }        → { token, dispositivo }

POST /api/ingest        Authorization: Bearer <token de dispositivo>
  { origem: "health-connect",
    atividades: [{ origem_id, data, tipo, duracao_min, kcal }],
    pesos:      [{ data, peso_kg }] }            → { atividades, pesos }
```

---

## O custo que esta fase cobra

Cada `db.execute` virou uma ida ao servidor, que faz outra ida ao Turso. Uma
carga do dashboard mede **32 chamadas a `/api/db`** — antes eram 32 idas
diretas ao banco, agora são 32 idas duplas, com o cold start da função no
meio.

Não é bloqueante (o TanStack Query já cacheia, e `batch` continua sendo uma
requisição para N comandos), mas é a próxima coisa a medir em produção. As
saídas, se doer: agrupar as consultas de abertura de tela num `batch`, ou
mover as telas mais pesadas para endpoints próprios — que é o mesmo caminho
que resolveria o SQL-vindo-do-cliente.
