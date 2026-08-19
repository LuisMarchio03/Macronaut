import { ExternalLink } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { MapaMuscular } from "@/components/treino/mapa-muscular";
import { listaPorVirgula, passosDaExecucao, urlDeExecucao } from "@/domain/treino";
import type { Equipamento, Exercise, TipoExercicio } from "@/domain/types";

const EQUIPAMENTO: Record<Equipamento, string> = {
  barra: "Barra",
  halter: "Halteres",
  maquina: "Máquina",
  polia: "Polia",
  peso_corporal: "Peso corporal",
  cardio: "Cardio",
};

const TIPO: Record<TipoExercicio, string> = {
  composto: "Composto",
  isolado: "Isolado",
};

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 text-[0.8125rem] text-muted-foreground">
      {children}
    </span>
  );
}

function LinkExecucao({ nome, onde }: { nome: string; onde: "google" | "youtube" }) {
  return (
    <a
      href={urlDeExecucao(nome, onde)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-input bg-card text-[0.8125rem] font-medium transition-colors hover:bg-muted"
    >
      {onde === "google" ? "Google" : "YouTube"}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

/**
 * A ficha de um exercício: o que ele pega, e como se faz.
 *
 * Não mostra o seu histórico de propósito. A carga ao longo do tempo já tem
 * dono — a aba Progresso —, e a última vez aparece na tela da sessão, ao lado
 * da carga de hoje, que é onde ela serve para decidir alguma coisa. Um
 * terceiro lugar com o mesmo número seria a lista de atalhos do hub outra vez.
 *
 * A execução sai para o Google e o YouTube em vez de morar aqui: hospedar
 * vídeo custa rede (o app é offline-first), licença e um casamento
 * nome→imagem que falha em metade de um catálogo em português. O boneco
 * responde "que músculo", que é a pergunta que o app tem dado como responder
 * sozinho e para sempre.
 */
export function SheetExercicio({
  aberto,
  onFechar,
  exercicio,
}: {
  aberto: boolean;
  onFechar: () => void;
  exercicio: Exercise | null;
}) {
  if (!exercicio) return null;

  const secundarios = listaPorVirgula(exercicio.musculos_secundarios);
  const passos = passosDaExecucao(exercicio.instrucoes);
  const apelidos = listaPorVirgula(exercicio.aliases);

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{exercicio.nome}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="flex justify-center">
            <MapaMuscular primario={exercicio.grupo_nome} secundarios={secundarios} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {exercicio.grupo_nome && <Etiqueta>{exercicio.grupo_nome}</Etiqueta>}
            {secundarios.map((g) => (
              <Etiqueta key={g}>também {g}</Etiqueta>
            ))}
            {exercicio.tipo && <Etiqueta>{TIPO[exercicio.tipo]}</Etiqueta>}
            {exercicio.equipamento && <Etiqueta>{EQUIPAMENTO[exercicio.equipamento]}</Etiqueta>}
            {exercicio.met !== null && <Etiqueta>{exercicio.met} MET</Etiqueta>}
          </div>

          <div>
            <h3 className="t-section">Como executar</h3>
            {passos.length > 0 ? (
              <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm marker:text-[0.8125rem] marker:text-muted-foreground">
                {passos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            ) : (
              <p className="t-caption mt-1">
                Sem passos de execução cadastrados — os links abaixo mostram como se faz.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <LinkExecucao nome={exercicio.nome} onde="google" />
            <LinkExecucao nome={exercicio.nome} onde="youtube" />
          </div>

          {apelidos.length > 0 && (
            <p className="t-caption">Também chamado de {apelidos.join(", ")}.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
