import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SheetExercicio } from "./sheet-exercicio";
import type { Exercise } from "../../domain/types";

function ex(p: Partial<Exercise> = {}): Exercise {
  return {
    id: 1,
    user_id: null,
    nome: "Supino reto com barra",
    grupo_muscular: null,
    grupo_id: 1,
    grupo_nome: "Peito",
    source: "catalogo",
    tipo: "composto",
    equipamento: "barra",
    met: null,
    fracao_corporal: null,
    medida: null,
    instrucoes: "Deite no banco com os pés no chão.\nDesça a barra até o meio do peito.\nEmpurre até estender os cotovelos.",
    musculos_secundarios: "Tríceps, Ombros",
    aliases: "supino, bench press",
    created_at: "2026-08-01T00:00:00.000Z",
    ...p,
  };
}

function montar(e: Exercise) {
  return render(<SheetExercicio aberto exercicio={e} onFechar={() => {}} />);
}

describe("Ficha do exercício", () => {
  it("mostra o grupo que trabalha e os que também recruta", () => {
    montar(ex());
    const mapa = screen.getByRole("img", { name: /trabalha peito/i });
    expect(mapa).toHaveAccessibleName(/tríceps/i);
    expect(mapa).toHaveAccessibleName(/ombros/i);
  });

  it("o mapa acende o primário e o secundário em pesos diferentes", () => {
    // `baseElement`, não `container`: o sheet renderiza em portal.
    const { baseElement } = montar(ex());
    expect(baseElement.querySelector('[data-grupo="Peito"][data-realce="primario"]')).not.toBeNull();
    expect(
      baseElement.querySelector('[data-grupo="Tríceps"][data-realce="secundario"]'),
    ).not.toBeNull();
    // Um grupo que o exercício não pega não acende.
    expect(baseElement.querySelector('[data-grupo="Core"][data-realce="primario"]')).toBeNull();
  });

  it("lista a execução em passos numerados", () => {
    montar(ex());
    const passos = screen.getAllByRole("listitem");
    expect(passos.map((p) => p.textContent)).toEqual([
      "Deite no banco com os pés no chão.",
      "Desça a barra até o meio do peito.",
      "Empurre até estender os cotovelos.",
    ]);
  });

  /** O app não hospeda vídeo: manda para onde a resposta já existe. */
  it("leva para a execução no Google e no YouTube", () => {
    montar(ex());
    const google = screen.getByRole("link", { name: /google/i });
    expect(decodeURIComponent(google.getAttribute("href") ?? "")).toContain(
      "Supino reto com barra execução correta",
    );
    expect(google).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /youtube/i })).toBeInTheDocument();
  });

  it("diz por que outros nomes o exercício é conhecido", () => {
    montar(ex());
    expect(screen.getByText(/bench press/i)).toBeInTheDocument();
  });

  /**
   * Exercício que você cadastrou tem só nome e grupo. A ficha vazia não pode
   * fingir que existe — mas os links de execução funcionam para qualquer nome,
   * e são justamente o que serve a quem não tem ficha.
   */
  it("exercício sem ficha não finge ter uma, e ainda leva à execução", () => {
    montar(ex({ instrucoes: null, musculos_secundarios: null, aliases: null, source: "custom" }));
    expect(screen.getByText(/sem passos de execução/i)).toBeInTheDocument();
    expect(screen.queryByText(/também chamado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /google/i })).toBeInTheDocument();
  });
});
