import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { ChipsMultiplos } from "@/components/ui/chips-multiplos";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { listaPorVirgula } from "@/domain/treino";
import type { Equipamento, Exercise, MuscleGroup, TipoExercicio } from "@/domain/types";
import type { ExInput } from "@/repositories/exercises";

const EQUIPAMENTOS: { valor: Equipamento; label: string }[] = [
  { valor: "barra", label: "Barra" },
  { valor: "halter", label: "Halteres" },
  { valor: "maquina", label: "Máquina" },
  { valor: "polia", label: "Polia" },
  { valor: "peso_corporal", label: "Peso corporal" },
  { valor: "cardio", label: "Cardio" },
];

const TIPOS = [
  { valor: "composto" as const, label: "Composto", descricao: "Movimento composto" },
  { valor: "isolado" as const, label: "Isolado", descricao: "Movimento isolado" },
];

/**
 * O cadastro de um exercício seu.
 *
 * Virou sheet: antes ele TROCAVA o painel inteiro pela ficha de edição, então
 * cadastrar um exercício apagava da tela a lista que você estava consultando
 * para decidir se ele já existia.
 *
 * `equipamento` deixou de ser exclusivo do catálogo porque é ele que decide se
 * a sessão trata o item como duração ou como séries — sem o campo, não havia
 * como cadastrar um cardio próprio, só usar os doze que vieram prontos.
 */
export function SheetExercicioForm({
  aberto,
  onFechar,
  exercicio,
  grupos,
  onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** `null` = novo. */
  exercicio: Exercise | null;
  grupos: MuscleGroup[];
  onSalvar: (e: ExInput) => void;
}) {
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [tipo, setTipo] = useState<TipoExercicio | null>(null);
  const [equipamento, setEquipamento] = useState<Equipamento | "">("");
  const [met, setMet] = useState("");
  const [secundarios, setSecundarios] = useState<string[]>([]);
  const [apelidos, setApelidos] = useState("");
  const [instrucoes, setInstrucoes] = useState("");

  // Reabrir para outro exercício precisa recarregar tudo; sem isto o segundo
  // aberto mostraria a ficha do primeiro.
  useEffect(() => {
    if (!aberto) return;
    setNome(exercicio?.nome ?? "");
    setGrupoId(exercicio?.grupo_id != null ? String(exercicio.grupo_id) : "");
    setTipo(exercicio?.tipo ?? null);
    setEquipamento(exercicio?.equipamento ?? "");
    setMet(exercicio?.met != null ? String(exercicio.met) : "");
    setSecundarios(listaPorVirgula(exercicio?.musculos_secundarios));
    setApelidos(exercicio?.aliases ?? "");
    setInstrucoes(exercicio?.instrucoes ?? "");
  }, [aberto, exercicio]);

  const ehCardio = equipamento === "cardio";
  const opcoesSecundarios = grupos
    .filter((g) => String(g.id) !== grupoId)
    .map((g) => ({ valor: g.nome, label: g.nome }));

  function salvar() {
    const limpo = nome.trim();
    if (!limpo) return;
    const n = Number(met.replace(",", "."));
    onSalvar({
      nome: limpo,
      grupo_id: grupoId ? Number(grupoId) : null,
      tipo,
      equipamento: equipamento || null,
      met: ehCardio && met.trim() !== "" && !Number.isNaN(n) ? n : null,
      musculos_secundarios: secundarios.length > 0 ? secundarios.join(", ") : null,
      aliases: listaPorVirgula(apelidos).join(", ") || null,
      instrucoes: instrucoes.trim() || null,
    });
    onFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(v: boolean) => !v && onFechar()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{exercicio ? "Editar exercício" : "Novo exercício"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div>
            <Label htmlFor="ex-nome">Nome</Label>
            <Input id="ex-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="ex-grupo">Grupo muscular</Label>
            <select
              id="ex-grupo"
              className="select-field"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
            >
              <option value="">Sem grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="ex-equip">Equipamento</Label>
            <select
              id="ex-equip"
              className="select-field"
              value={equipamento}
              onChange={(e) => setEquipamento(e.target.value as Equipamento | "")}
            >
              <option value="">Não informado</option>
              {EQUIPAMENTOS.map((eq) => (
                <option key={eq.valor} value={eq.valor}>
                  {eq.label}
                </option>
              ))}
            </select>
          </div>

          {ehCardio ? (
            <div>
              <Label htmlFor="ex-met">MET</Label>
              <Input
                id="ex-met"
                inputMode="decimal"
                value={met}
                onChange={(e) => setMet(e.target.value)}
              />
              <p className="t-caption mt-1">
                O custo do exercício por hora e por quilo. É dele e do seu peso que sai a caloria —
                caminhada 3,5, corrida 9,8, pular corda 11.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Tipo</Label>
                <ChipGroup
                  opcoes={TIPOS}
                  valor={tipo}
                  onChange={setTipo}
                  rotulo="Tipo de movimento"
                  desmarcavel
                  colunas={2}
                />
              </div>

              <div>
                <Label>Também trabalha</Label>
                <ChipsMultiplos
                  opcoes={opcoesSecundarios}
                  valores={secundarios}
                  onChange={setSecundarios}
                  rotulo="Músculos secundários"
                  rotuloDe={(g) => `Também trabalha ${g}`}
                />
                <p className="t-caption mt-1">
                  Só desenho e ficha: a análise conta série pelo grupo principal.
                </p>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="ex-aliases">Outros nomes</Label>
            <Input
              id="ex-aliases"
              value={apelidos}
              placeholder="supino, bench"
              onChange={(e) => setApelidos(e.target.value)}
            />
            <p className="t-caption mt-1">
              Separados por vírgula. É por eles que a busca acha o exercício pelo nome que você usa.
            </p>
          </div>

          <div>
            <Label htmlFor="ex-instrucoes">Como executar</Label>
            <Textarea
              id="ex-instrucoes"
              value={instrucoes}
              placeholder={"Deite no banco com os pés no chão.\nDesça a barra até o meio do peito."}
              onChange={(e) => setInstrucoes(e.target.value)}
            />
            <p className="t-caption mt-1">Um passo por linha.</p>
          </div>
        </div>

        <SheetFooter>
          <Button block onClick={salvar} disabled={!nome.trim()}>
            Salvar
          </Button>
          <Button variant="outline" block onClick={onFechar}>
            Cancelar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
