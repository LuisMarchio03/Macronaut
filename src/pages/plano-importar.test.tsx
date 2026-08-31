import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { DbProvider } from "../lib/db-context";
import { criarApiLocal } from "@/../test/helpers/api-local";
import { PlanoImportar } from "./plano-importar";
import { getPlanoAtivo, listBlocos } from "../repositories/plano";

let db: Client;
beforeEach(async () => {
  db = await createTestDb();
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DbProvider api={criarApiLocal(db, 1)}>
        <MemoryRouter>
          <PlanoImportar />
        </MemoryRouter>
      </DbProvider>
    </QueryClientProvider>,
  );
}

const arquivo = (nome: string, conteudo: string) =>
  new File([conteudo], nome, { type: "text/csv" });

const PLANO_CSV = [
  "MEU PLANO,,,,",
  "Meta Calórica Diária: 1800 kcal,,,,",
  ",,,,",
  "REFEIÇÃO,HORÁRIO,ALIMENTOS,CALORIAS,OBSERVAÇÕES",
  "Café da Manhã,7h00 - 8h00,3 ovos mexidos,~400 kcal,",
  ",,1 fatia de pão integral,,",
  "💧 ÁGUA,8h00 - 12h00,750ml,,Ao longo da manhã",
  "Almoço,12h00 - 13h00,120g de frango,~500 kcal,",
].join("\n");

async function enviar(conteudo: string, nome = "plano.csv") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  // `applyAccept: false` desliga o filtro que o userEvent faz pelo atributo
  // `accept`: sem isso ele descarta o arquivo em silêncio e o teste do formato
  // recusado nunca chegaria no código do app.
  await userEvent.upload(input, arquivo(nome, conteudo), { applyAccept: false });
}

describe("prévia antes de gravar", () => {
  it("mostra o que vai entrar sem ter gravado nada ainda", async () => {
    // O usuário confere antes de o plano existir no banco — importar sem ver
    // o resultado é como executar um script sem lê-lo.
    renderPage();
    await enviar(PLANO_CSV);

    expect(await screen.findByText("O que vai entrar")).toBeInTheDocument();
    expect(await getPlanoAtivo(db, 1)).toBeNull();
  });

  it("conta refeições, água e suplementos", async () => {
    renderPage();
    await enviar(PLANO_CSV);

    await screen.findByText("O que vai entrar");
    expect(screen.getByText("refeições").previousElementSibling).toHaveTextContent("2");
    expect(screen.getByText("períodos de água").previousElementSibling).toHaveTextContent("1");
  });

  it("lista os blocos para conferência, com horário e alimentos", async () => {
    renderPage();
    await enviar(PLANO_CSV);

    await screen.findByText("Conferência");
    expect(screen.getByText("7h – 8h")).toBeInTheDocument();
    expect(screen.getByText("3 ovos mexidos")).toBeInTheDocument();
    expect(screen.getByText("1 fatia de pão integral")).toBeInTheDocument();
  });

  it("mostra o nome do arquivo e o nome do plano", async () => {
    renderPage();
    await enviar(PLANO_CSV, "minha-dieta.csv");

    expect(await screen.findByText("minha-dieta.csv")).toBeInTheDocument();
    expect(screen.getByText("MEU PLANO")).toBeInTheDocument();
  });
});

describe("importação", () => {
  it("grava o plano ao confirmar", async () => {
    renderPage();
    await enviar(PLANO_CSV);

    await userEvent.click(await screen.findByRole("button", { name: /^importar$/i }));

    await expect
      .poll(async () => (await getPlanoAtivo(db, 1))?.nome, { timeout: 8000 })
      .toBe("MEU PLANO");

    const plano = (await getPlanoAtivo(db, 1))!;
    const blocos = await listBlocos(db, 1, plano.id);
    expect(blocos.map((b) => b.tipo)).toEqual(["refeicao", "agua", "refeicao"]);
    expect(plano.origem).toBe("csv");
  });

  it("deixa escolher outro arquivo sem gravar", async () => {
    renderPage();
    await enviar(PLANO_CSV);

    await userEvent.click(await screen.findByRole("button", { name: /escolher outro/i }));
    expect(screen.getByText("Escolher planilha")).toBeInTheDocument();
    expect(await getPlanoAtivo(db, 1)).toBeNull();
  });
});

describe("planilha com problema", () => {
  it("bloqueia a importação e explica o erro", async () => {
    const semAlimento = [
      "REFEIÇÃO,HORÁRIO,ALIMENTOS,CALORIAS",
      "Almoço,12h00 - 13h00,,~500 kcal",
    ].join("\n");

    renderPage();
    await enviar(semAlimento);

    expect(await screen.findByText("1 problema impede a importação")).toBeInTheDocument();
    expect(screen.getByText(/sem nenhum alimento/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^importar$/i })).toBeDisabled();
  });

  it("mostra avisos sem bloquear", async () => {
    const semMacros = [
      "REFEIÇÃO,HORÁRIO,ALIMENTOS,CALORIAS",
      "Almoço,12h00 - 13h00,arroz,~500 kcal",
    ].join("\n");

    renderPage();
    await enviar(semMacros);

    expect(await screen.findByText("2 avisos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^importar$/i })).toBeEnabled();
  });

  it("recusa formato que não sabe ler, dizendo o que aceita", async () => {
    renderPage();
    await enviar("conteúdo qualquer", "dieta.pdf");

    expect(await screen.findByText(/Envie um arquivo \.xlsx ou \.csv/i)).toBeInTheDocument();
  });

  it("explica o arquivo vazio em vez de chamá-lo de corrompido", async () => {
    renderPage();
    await enviar("", "plano.xlsx");

    expect(await screen.findByText(/veio vazio/i)).toBeInTheDocument();
  });
});

/**
 * No celular a planilha vem do Drive, do WhatsApp ou do "Arquivos", e muitas
 * vezes chega sem extensão no nome. Enquanto o formato era decidido pelo nome,
 * escolher o arquivo certo não produzia prévia nem erro — nada acontecia.
 */
describe("arquivo escolhido no celular", () => {
  const TEMPLATE = readFileSync("public/template-macronaut.xlsx");

  async function enviarBytes(nome: string) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const f = new File([new Uint8Array(TEMPLATE)], nome, { type: "application/octet-stream" });
    await userEvent.upload(input, f, { applyAccept: false });
  }

  it("lê o .xlsx que chegou sem extensão no nome", async () => {
    renderPage();
    await enviarBytes("documento");

    expect(await screen.findByText("O que vai entrar")).toBeInTheDocument();
    expect(screen.getByText("MEU PLANO ALIMENTAR")).toBeInTheDocument();
  });

  it("grava esse plano com a origem xlsx, não csv", async () => {
    renderPage();
    await enviarBytes("documento");

    await userEvent.click(await screen.findByRole("button", { name: /^importar$/i }));

    await expect
      .poll(async () => (await getPlanoAtivo(db, 1))?.origem, { timeout: 8000 })
      .toBe("xlsx");
  });
});

describe("template", () => {
  it("oferece o download do modelo para quem ainda não tem planilha", () => {
    renderPage();
    const xlsx = screen.getByRole("link", { name: /template \.xlsx/i });
    expect(xlsx).toHaveAttribute("href", "/template-macronaut.xlsx");
    expect(xlsx).toHaveAttribute("download");
  });

  it("oferece também os CSVs separados", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /plano\.csv/i })).toHaveAttribute(
      "href",
      "/template-plano.csv",
    );
  });
});
