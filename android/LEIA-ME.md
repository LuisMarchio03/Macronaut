# App Android — TWA + Health Connect

> ## ⚠️ Este código nunca foi compilado
>
> Não há toolchain Android na máquina onde ele foi escrito (`java`, `gradle`,
> `adb` e o SDK não existem lá), e a documentação do Samsung Health diz que ele
> **não funciona em emulador** — o Health Connect com dados reais só existe num
> aparelho físico.
>
> O que **está** verificado, por testes que rodam no repositório web:
>
> - o formato do lote que este app envia, rodado pela validação real do
>   servidor (`api/_lib/contrato-android.test.ts`);
> - o domínio nos três lugares que precisam concordar, as permissões do
>   manifesto contra o que o código lê, e o `assetlinks.json`
>   (`api/_lib/android-config.test.ts`).
>
> O que **não** está: se isto compila. Conte com uma rodada de erros de
> compilação na primeira vez — versões de dependência e nomes de constante do
> Health Connect são o suspeito provável.

## O que ele faz

Duas coisas, e nada além:

1. **Abre o Macronaut em tela cheia** (Trusted Web Activity). É o PWA de
   sempre, sem barra de endereço, com ícone na gaveta de apps.
2. **Lê o Health Connect a cada 6 horas** e manda exercício e peso para o
   Macronaut.

O Samsung Health não é lido direto — ele **escreve** no Health Connect, e este
app lê de lá. É de propósito: o mesmo código serve a quem usa Garmin, Fitbit ou
o relógio do Google, sem uma linha a mais.

Os dados não atravessam a TWA. Ela é o Chrome renderizando o site e não tem
ponte para o nativo (não suporta `postMessage` nem `addJavascriptInterface`);
quem fala com o servidor é o worker, direto.

## Antes de compilar

**1. Troque o domínio**, se não for `macronaut-jade.vercel.app`. Ele aparece em
três lugares, e o teste `android-config.test.ts` do repositório web falha se
eles divergirem:

| Onde | O quê |
|---|---|
| `app/build.gradle.kts` | `resValue(... "url_do_app", "https://…")` |
| `app/src/main/res/values/strings.xml` | `host_do_app` (só o host) |
| `app/src/main/java/dev/macronaut/sync/SyncWorker.kt` | `const val BASE` |

**2. Gere a chave de assinatura** e ponha o fingerprint no site:

```bash
keytool -genkey -v -keystore macronaut.keystore -alias macronaut \
        -keyalg RSA -keysize 2048 -validity 10000

keytool -list -v -keystore macronaut.keystore -alias macronaut | grep SHA256
```

O SHA256 vai em `public/.well-known/assetlinks.json` do repositório web, no
lugar do `SUBSTITUA:...`. **Sem isso a TWA abre como Custom Tab**, com a barra
de URL à mostra e sem parecer um app — e não há mensagem de erro nenhuma.

> O `vercel.json` exclui `.well-known/` do fallback de SPA
> (`"/((?!api/|.well-known/).*)"`). Sem isso o Chrome poderia receber o
> `index.html` ao buscar o `assetlinks.json`, e a verificação falharia — de
> novo, em silêncio. (Arquivo estático já vence rewrite na Vercel; a exclusão
> explícita é para não depender dessa ordem.)
>
> Se você publicar pela Play Store com **Play App Signing**, o fingerprint que
> vale é o que o Play Console mostra em *Setup → App integrity*, não o da sua
> chave local. Usar o errado dá o mesmo silêncio.

**3. Ícone.** O manifesto aponta para `@mipmap/ic_launcher`, que ainda não
existe neste projeto — o Android Studio gera pelo *New → Image Asset*, ou
copie de `public/` do site.

## Compilar e rodar

```bash
cd android
./gradlew assembleDebug                 # o wrapper é gerado pelo Android Studio
adb install app/build/outputs/apk/debug/app-debug.apk
```

Não há `gradle/wrapper/` neste repositório: abra a pasta `android/` no Android
Studio uma vez e ele o cria.

## Conectar o aparelho

A tela de pareamento **não** aparece no lançador — ela é `category.INFO`, e o
ícone principal abre a TWA. Chegue nela por:

```bash
adb shell am start -n dev.macronaut.app/dev.macronaut.app.ParearActivity
```

Ou promova-a a `LAUNCHER` no manifesto enquanto testa.

O fluxo:

1. No navegador: **Mais → Ajustes → Aparelhos conectados → Conectar**. Aparece
   um código de oito caracteres, válido por cinco minutos.
2. No celular: a tela pede a permissão do Health Connect primeiro (um app
   pareado e sem permissão sincronizaria vazio para sempre), depois o código.
3. `POST /api/parear` devolve o token do dispositivo, o worker é agendado, e o
   aparelho aparece na lista do navegador.

**Desconectar** na tela do Macronaut corta o envio na sincronização seguinte:
o servidor confere se o dispositivo ainda existe a cada chamada, e o app
esquece o token ao receber 401.

## Forçar uma sincronização no teste

Esperar seis horas para saber se funcionou não é um ciclo de trabalho:

```bash
adb shell am broadcast -a androidx.work.diagnostics.REQUEST_DIAGNOSTICS \
    -p dev.macronaut.app
adb logcat -s WM-WorkerWrapper Macronaut
```

Ou reduza o período em `SyncWorker.agendar` para 15 minutos (o mínimo que o
`WorkManager` aceita) enquanto testa.

## Publicar

O que a Play Store vai cobrar, e que não é pouco:

- **Conta de desenvolvedor**, US$ 25, uma vez.
- **Formulário de declaração do Health Connect** — a lista de permissões e o
  que cada uma faz. As três aqui são leitura de exercício, calorias e peso, e o
  texto do formulário tem que casar com o que a `PoliticaActivity` mostra.
- **Revisão da política de dados de saúde** do Google. A política de
  privacidade declarada no Play Console tem que ser a **mesma** que a tela do
  app exibe; divergir é reprovação.
- **Data safety form**, declarando que dados de saúde são coletados e para onde
  vão.

Nada disso depende do código. Depende de o texto ser verdadeiro e igual nos
dois lugares — e ele já é, em `strings.xml`.

## O que ficou de fora

Água, nutrição, passos e sono. Água e nutrição precisariam de deduplicação
própria (não têm id estável como a sessão de exercício tem), e passos
contariam de novo o que a caminhada registrada já contou no balanço energético.

A janela de releitura é de 7 dias: reler é barato e a deduplicação do servidor
absorve a repetição, mas um relógio que sincroniza tarde grava o treino de
ontem depois de a janela de ontem ter passado — sem a sobreposição, aquele
treino nunca chegaria.
