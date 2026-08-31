import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * O que dá para verificar do app Android sem compilá-lo.
 *
 * Não há toolchain Android nesta máquina e o Samsung Health não roda em
 * emulador, então o Kotlin não é compilado aqui. O que ESTES testes prendem é
 * a configuração — e é justamente ela que quebra em silêncio:
 *
 * - domínio divergente entre os três lugares → a verificação de Digital Asset
 *   Links falha e a TWA abre como Custom Tab, com barra de URL à mostra;
 * - `assetlinks.json` malformado → o mesmo, sem nenhum erro visível;
 * - permissão declarada e não usada (ou o contrário) → reprovação na revisão
 *   do Google, descoberta semanas depois.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (p: string) => readFileSync(resolve(RAIZ, p), "utf-8");

const gradle = ler("android/app/build.gradle.kts");
const strings = ler("android/app/src/main/res/values/strings.xml");
const manifesto = ler("android/app/src/main/AndroidManifest.xml");
const worker = ler("android/app/src/main/java/dev/macronaut/sync/SyncWorker.kt");
const saude = ler("android/app/src/main/java/dev/macronaut/sync/Saude.kt");
const assetlinks = JSON.parse(ler("public/.well-known/assetlinks.json")) as {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
}[];

const urlDoApp = /resValue\("string",\s*"url_do_app",\s*"([^"]+)"\)/.exec(gradle)?.[1];
const hostDoApp = /<string name="host_do_app">([^<]+)<\/string>/.exec(strings)?.[1];
const baseDoWorker = /const val BASE = "([^"]+)"/.exec(worker)?.[1];

describe("o domínio, nos três lugares que precisam concordar", () => {
  it("os três estão preenchidos", () => {
    expect(urlDoApp).toBeTruthy();
    expect(hostDoApp).toBeTruthy();
    expect(baseDoWorker).toBeTruthy();
  });

  it("o host do intent-filter é o host da URL que a TWA abre", () => {
    // Divergir aqui não dá erro: a TWA só deixa de ser confiável e a barra de
    // endereço reaparece.
    expect(hostDoApp).toBe(new URL(urlDoApp!).host);
  });

  it("o worker sincroniza para o mesmo servidor que a TWA abre", () => {
    // Divergir aqui manda os treinos para outro lugar, calado.
    expect(baseDoWorker).toBe(urlDoApp);
  });

  it("é HTTPS — a TWA recusa qualquer outra coisa", () => {
    expect(new URL(urlDoApp!).protocol).toBe("https:");
  });
});

describe("assetlinks.json", () => {
  it("tem a forma que o Chrome procura", () => {
    expect(assetlinks).toHaveLength(1);
    expect(assetlinks[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
    expect(assetlinks[0].target.namespace).toBe("android_app");
  });

  it("aponta para o applicationId do Gradle", () => {
    const appId = /applicationId = "([^"]+)"/.exec(gradle)?.[1];
    expect(assetlinks[0].target.package_name).toBe(appId);
  });

  it("o fingerprint ainda é o placeholder, e isso está dito", () => {
    // Este teste falha DE PROPÓSITO quando o fingerprint real entrar — é o
    // lembrete de vir aqui trocar a asserção e conferir o formato.
    const fp = assetlinks[0].target.sha256_cert_fingerprints[0];
    expect(fp).toContain("SUBSTITUA");
  });
});

describe("permissões do Health Connect", () => {
  const declaradas = [...manifesto.matchAll(/android\.permission\.health\.(\w+)/g)].map((m) => m[1]);

  it("declara exatamente as três que o app lê", () => {
    expect(declaradas.sort()).toEqual(["READ_EXERCISE", "READ_TOTAL_CALORIES_BURNED", "READ_WEIGHT"]);
  });

  it("cada permissão declarada tem um tipo de registro correspondente no código", () => {
    // Pedir mais do que se usa é motivo de reprovação na revisão, e usar o que
    // não se pediu é uma exceção em tempo de execução no celular de quem
    // instalou.
    expect(saude).toContain("ExerciseSessionRecord::class");
    expect(saude).toContain("TotalCaloriesBurnedRecord::class");
    expect(saude).toContain("WeightRecord::class");
  });

  it("não pede escrita — o app só lê", () => {
    expect(manifesto).not.toMatch(/android\.permission\.health\.WRITE_/);
  });

  it("declara a tela de política de privacidade que o Health Connect exige", () => {
    // Sem ela o app não passa na revisão, e o link "Política de privacidade"
    // do diálogo de permissões não leva a lugar nenhum.
    expect(manifesto).toContain("androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE");
    expect(manifesto).toContain("android.intent.action.VIEW_PERMISSION_USAGE");
    expect(manifesto).toContain("android.intent.category.HEALTH_PERMISSIONS");
  });

  it("declara a visibilidade do pacote do Health Connect", () => {
    // Sem o <queries>, a partir do Android 11 o app não enxerga que o Health
    // Connect está instalado — e reporta "indisponível" num aparelho que o tem.
    expect(manifesto).toContain("com.google.android.apps.healthdata");
  });
});

describe("as Activities do manifesto existem no código", () => {
  const namespace = /namespace = "([^"]+)"/.exec(gradle)?.[1];

  it("o namespace resolve os nomes relativos do manifesto", () => {
    // `.ParearActivity` no manifesto é `<namespace>.ParearActivity`. Se o
    // pacote do arquivo Kotlin não bater, o app instala e crasha ao abrir.
    expect(namespace).toBe("dev.macronaut.app");
    for (const nome of ["ParearActivity", "PoliticaActivity"]) {
      expect(manifesto).toContain(`.${nome}`);
      expect(ler(`android/app/src/main/java/dev/macronaut/app/${nome}.kt`)).toContain(
        `package ${namespace}`,
      );
    }
  });
});
