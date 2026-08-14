import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CircleAlert,
  Download,
  FileSpreadsheet,
  TriangleAlert,
  Upload,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Page, PageHeader, SectionLabel } from "@/components/ui/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { useImportarPlano } from "@/hooks/use-plano";
import { montarRascunho, validarPlano } from "@/domain/plano-parse";
import { ArquivoInvalido, ehCsv, lerAbas } from "@/lib/planilha";
import { janelaHoraria } from "@/lib/date";
import type { Problema, RascunhoPlano } from "@/domain/plano-types";

interface Previa {
  nomeArquivo: string;
  origem: "xlsx" | "csv";
  rascunho: RascunhoPlano;
  erros: Problema[];
  avisos: Problema[];
}

export function PlanoImportar() {
  const navigate = useNavigate();
  const importar = useImportarPlano();

  const [previa, setPrevia] = useState<Previa | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function analisar(arquivo: File) {
    setFalha(null);
    setPrevia(null);
    setLendo(true);
    try {
      const abas = await lerAbas(arquivo);
      const { rascunho, problemas } = montarRascunho(abas);
      const { erros, avisos } = validarPlano(rascunho, problemas);
      setPrevia({
        nomeArquivo: arquivo.name,
        origem: ehCsv(arquivo.name) ? "csv" : "xlsx",
        rascunho,
        erros,
        avisos,
      });
    } catch (e) {
      setFalha(
        e instanceof ArquivoInvalido
          ? e.message
          : "Não consegui ler o arquivo. Tente exportar de novo como .xlsx.",
      );
    } finally {
      setLendo(false);
    }
  }

  function confirmar() {
    if (!previa || previa.erros.length > 0) return;
    importar.mutate(
      { rascunho: previa.rascunho, origem: previa.origem },
      { onSuccess: () => navigate("/plano") },
    );
  }

  const refeicoes = previa?.rascunho.blocos.filter((b) => b.tipo === "refeicao") ?? [];
  const aguas = previa?.rascunho.blocos.filter((b) => b.tipo === "agua") ?? [];
  const suplementos = previa?.rascunho.blocos.filter((b) => b.tipo === "suplemento") ?? [];
  const podeImportar = previa != null && previa.erros.length === 0;

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link to="/plano" className="inline-flex items-center gap-1 text-primary">
            <ArrowLeft className="size-3.5" />
            Plano
          </Link>
        }
        title="Importar planilha"
      />

      {!previa && (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              const f = e.dataTransfer.files[0];
              if (f) void analisar(f);
            }}
            className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              arrastando ? "border-primary bg-tint-primary" : "border-border bg-card"
            }`}
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Upload className="size-5" />
            </span>
            <span className="mt-3 text-[0.9375rem] font-semibold">
              {lendo ? "Lendo o arquivo…" : "Escolher planilha"}
            </span>
            <span className="t-caption mt-1 max-w-[32ch]">
              Arraste aqui ou toque para escolher. Aceita .xlsx e .csv.
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void analisar(f);
                e.target.value = "";
              }}
            />
          </label>

          {falha && (
            <Card tone="danger">
              <p className="flex gap-2 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>{falha}</span>
              </p>
            </Card>
          )}

          <Card header="Não tem uma planilha ainda?">
            <p className="t-caption">
              Baixe o template, preencha com a sua dieta e volte aqui. A primeira aba explica
              cada coluna.
            </p>
            <div className="mt-3 grid gap-2">
              <ButtonLink variant="outline" href="/template-macronaut.xlsx" download>
                <Download className="size-4" />
                Template .xlsx
              </ButtonLink>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["template-plano.csv", "Plano"],
                  ["template-macros.csv", "Macros"],
                  ["template-substituicoes.csv", "Trocas"],
                ].map(([arquivo, rotulo]) => (
                  <ButtonLink
                    key={arquivo}
                    variant="outline"
                    size="sm"
                    href={`/${arquivo}`}
                    download
                  >
                    {rotulo}.csv
                  </ButtonLink>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {previa && (
        <>
          <Card>
            <p className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate font-medium">{previa.nomeArquivo}</span>
            </p>
            <p className="t-caption mt-1">{previa.rascunho.meta.nome}</p>
          </Card>

          {previa.erros.length > 0 && (
            <Card
              tone="danger"
              header={
                previa.erros.length === 1
                  ? "1 problema impede a importação"
                  : `${previa.erros.length} problemas impedem a importação`
              }
            >
              <ul className="space-y-2">
                {previa.erros.map((e, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span>
                      <span className="font-medium">{e.onde}</span> — {e.mensagem}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {previa.avisos.length > 0 && (
            <Card
              tone="warning"
              header={previa.avisos.length === 1 ? "1 aviso" : `${previa.avisos.length} avisos`}
            >
              <p className="t-caption mb-2">
                Dá para importar mesmo assim. Vale conferir depois.
              </p>
              <ul className="space-y-2">
                {previa.avisos.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <span>
                      <span className="font-medium">{a.onde}</span> — {a.mensagem}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card header="O que vai entrar">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Resumo n={refeicoes.length} rotulo="refeições" />
              <Resumo n={aguas.length} rotulo="períodos de água" />
              <Resumo n={suplementos.length} rotulo="suplementos" />
              <Resumo n={previa.rascunho.substituicoes.length} rotulo="substituições" />
            </div>
          </Card>

          <div className="space-y-2">
            <SectionLabel>Conferência</SectionLabel>
            <Card padded={false}>
              <ul className="divide-y divide-border">
                {previa.rascunho.blocos.map((b, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{b.nome}</span>
                      <span className="t-caption shrink-0 tabular-nums">
                        {janelaHoraria(b.hora_inicio, b.hora_fim) || b.ancora}
                      </span>
                    </div>
                    {b.itens.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {b.itens.map((it, j) => (
                          <li key={j} className="t-caption">
                            {it.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setPrevia(null)}>
              Escolher outro
            </Button>
            <Button disabled={!podeImportar || importar.isPending} onClick={confirmar}>
              <Check className="size-4" />
              {importar.isPending ? "Importando…" : "Importar"}
            </Button>
          </div>

          {podeImportar && (
            <p className="t-caption text-center">
              O plano ativo atual, se houver, fica guardado e pode ser reativado depois.
            </p>
          )}
        </>
      )}
    </Page>
  );
}

function Resumo({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums">{n}</div>
      <div className="t-caption">{rotulo}</div>
    </div>
  );
}
