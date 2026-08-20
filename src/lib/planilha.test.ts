import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ArquivoInvalido, lerAbas } from "./planilha";

const TEMPLATE = readFileSync("public/template-macronaut.xlsx");

function arquivo(conteudo: Uint8Array | string, nome: string): File {
  const dados = typeof conteudo === "string" ? [conteudo] : [new Uint8Array(conteudo)];
  return new File(dados, nome);
}

const xlsx = (nome: string) => arquivo(TEMPLATE, nome);

/** Cabeçalho OLE2 — a assinatura do Excel 97-2003 (`.xls`). */
const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
/** PNG: um binário que não é planilha nenhuma. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

const CSV = "Café da Manhã,7h00 - 8h00,3 ovos mexidos,~400 kcal\n";

async function mensagemDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "(não lançou)";
  } catch (e) {
    expect(e).toBeInstanceOf(ArquivoInvalido);
    return (e as Error).message;
  }
}

describe("lerAbas", () => {
  it("lê um .xlsx com as três abas e marca a origem", async () => {
    const { plano, macros, substituicoes, origem } = await lerAbas(xlsx("template.xlsx"));
    expect(origem).toBe("xlsx");
    expect(plano.length).toBeGreaterThan(0);
    expect(macros).not.toBeNull();
    expect(substituicoes).not.toBeNull();
  });

  /**
   * O caso que trava a importação no celular: escolhido do Drive, do WhatsApp
   * ou do "Arquivos", o mesmo .xlsx chega com um nome sem extensão. Decidir
   * pelo nome recusava uma planilha perfeitamente válida.
   */
  it("lê um .xlsx que chegou sem extensão no nome", async () => {
    const { plano, origem } = await lerAbas(xlsx("documento"));
    expect(origem).toBe("xlsx");
    expect(plano.length).toBeGreaterThan(0);
  });

  it("lê um .xlsx mesmo com a extensão errada — o conteúdo decide", async () => {
    const { origem } = await lerAbas(xlsx("plano-da-nutri.csv"));
    expect(origem).toBe("xlsx");
  });

  it("lê um .csv pelo nome", async () => {
    const { plano, macros, origem } = await lerAbas(arquivo(CSV, "plano.csv"));
    expect(origem).toBe("csv");
    expect(plano[0][0]).toBe("Café da Manhã");
    expect(macros).toBeNull();
  });

  it("lê um .csv que chegou sem extensão no nome", async () => {
    const { plano, origem } = await lerAbas(arquivo(CSV, "plano-exportado"));
    expect(origem).toBe("csv");
    expect(plano[0][0]).toBe("Café da Manhã");
  });

  it("diz o que fazer com um .xls do Excel antigo, em vez de só recusar", async () => {
    const msg = await mensagemDe(lerAbas(arquivo(OLE2, "plano.xls")));
    expect(msg).toMatch(/\.xls\b/);
    expect(msg).toMatch(/salv/i);
    expect(msg).toMatch(/\.xlsx/);
  });

  it("explica um arquivo vazio em vez de chamá-lo de corrompido", async () => {
    const msg = await mensagemDe(lerAbas(arquivo(new Uint8Array(), "plano.xlsx")));
    expect(msg).toMatch(/vazio/i);
    expect(msg).not.toMatch(/corrompid/i);
  });

  it("avisa quando o nome diz .xlsx mas o conteúdo não é planilha", async () => {
    const msg = await mensagemDe(lerAbas(arquivo(PNG, "plano.xlsx")));
    expect(msg).toMatch(/plano\.xlsx/);
  });

  it("recusa um binário que não é planilha nem texto", async () => {
    const msg = await mensagemDe(lerAbas(arquivo(PNG, "foto")));
    expect(msg).toMatch(/\.xlsx|\.csv/);
  });

  /**
   * O conteúdo só decide quando o nome não diz nada. Um nome que anuncia
   * outro formato é recusado antes: um .docx é zip por dentro, e um .pdf
   * começa com texto — os dois passariam pela farejada de conteúdo.
   */
  it("recusa pelo nome quando a extensão anuncia outro formato", async () => {
    expect(await mensagemDe(lerAbas(arquivo("conteúdo qualquer", "dieta.pdf")))).toMatch(
      /Envie um arquivo \.xlsx ou \.csv/,
    );
    expect(await mensagemDe(lerAbas(xlsx("dieta.docx")))).toMatch(
      /Envie um arquivo \.xlsx ou \.csv/,
    );
  });
});
