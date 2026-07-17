import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { DesambiguarPof } from "./desambiguar-pof";
import { useFoods, useFoodsByIds } from "../hooks/use-foods";
import { useFrequentes } from "../hooks/use-frequentes";
import { useMeasures, useMeasuresByFoodIds, useCandidatos } from "../hooks/use-food-measures";
import { useAddEntry, useUpdateEntry } from "../hooks/use-today-entries";
import { macrosDoEntry } from "../domain/nutrition";
import { sugerirPorcao } from "../domain/medida-default";
import { resolverQtdBase, formatarNumero, pluralizar } from "../domain/medidas";
import type { Food, FoodEntry } from "../domain/types";
import type { UsoFrequente } from "../domain/frequentes";

const BASE = "__base__"; // valor do <option> "registrar na unidade base"

export function AddFoodSheet({
  data, mealId, open, onClose, entryEdit,
}: {
  data: string;
  mealId: number | null;
  open: boolean;
  onClose: () => void;
  entryEdit?: { entry: FoodEntry; food: Food };
}) {
  const editando = entryEdit != null;
  const [termo, setTermo] = useState("");
  const [selecionado, setSelecionado] = useState<Food | null>(entryEdit?.food ?? null);
  // Em edição os campos vêm do registro existente, não da sugestão.
  const [qtd, setQtd] = useState(
    entryEdit ? String(entryEdit.entry.measure_count ?? entryEdit.entry.qty_g) : "",
  );
  const [measureId, setMeasureId] = useState<string>(
    entryEdit?.entry.measure_id != null ? String(entryEdit.entry.measure_id) : BASE,
  );
  /** Alimento cuja porção já foi pré-preenchida. Em edição já nasce preenchido. */
  const [iniciadoPara, setIniciadoPara] = useState<number | null>(entryEdit?.food.id ?? null);

  const { data: resultados = [] } = useFoods(termo);
  const { frequentes, recentes } = useFrequentes(mealId);
  // "Recentes" não repete o que já apareceu em "Frequentes" desta refeição —
  // mostrar o mesmo alimento duas vezes na tela não ajuda ninguém a decidir
  // mais rápido, é só ruído (e no caso de só existir 1 alimento no histórico,
  // as duas listas seriam idênticas).
  const recentesSemFrequentes = recentes.filter(
    (r) => !frequentes.some((f) => f.food_id === r.food_id),
  );
  const { data: medidas = [], isSuccess: medidasProntas } = useMeasures(selecionado?.id ?? null);
  const { data: candidatos = [] } = useCandidatos(selecionado?.id ?? null);
  const add = useAddEntry();
  const upd = useUpdateEntry(data);

  const precisaDesambiguar = candidatos.length > 0;

  /**
   * Pré-preenche a porção: a tela abre em "1 fatia", não em "100".
   *
   * Espera `medidasProntas` de propósito — as medidas chegam por query async.
   * Pré-preencher antes disso escolheria a unidade base (100 g) e o guard de
   * "já iniciei" impediria a correção quando a fatia chegasse.
   */
  useEffect(() => {
    if (!selecionado || precisaDesambiguar || !medidasProntas) return;
    if (iniciadoPara === selecionado.id) return;
    const s = sugerirPorcao(selecionado, medidas);
    setQtd(String(s.count));
    setMeasureId(s.measure ? String(s.measure.id) : BASE);
    setIniciadoPara(selecionado.id);
  }, [selecionado, medidas, medidasProntas, precisaDesambiguar, iniciadoPara]);

  const medida = medidas.find((m) => String(m.id) === measureId) ?? null;
  const qtdN = Number(qtd.replace(",", "."));
  const qtyG = medida ? resolverQtdBase(medida.qty_base, qtdN) : qtdN;
  const preview = selecionado && qtyG > 0 ? macrosDoEntry(selecionado, qtyG) : null;

  function limpar() {
    setSelecionado(null); setTermo(""); setQtd(""); setMeasureId(BASE); setIniciadoPara(null);
  }

  async function registrar() {
    if (!selecionado || qtyG <= 0) return;
    if (editando) {
      await upd.mutateAsync({
        id: entryEdit!.entry.id, qty_g: qtyG,
        measure_id: medida?.id ?? null, measure_count: medida ? qtdN : null,
      });
    } else {
      await add.mutateAsync({
        data, meal_id: mealId, food_id: selecionado.id, qty_g: qtyG,
        measure_id: medida?.id ?? null, measure_count: medida ? qtdN : null,
        label: mealId === null ? "Avulsa" : null,
      });
    }
    limpar();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { limpar(); onClose(); } }}>
      <SheetContent side="bottom" className="flex h-[90vh] flex-col">
        <SheetHeader>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary/70">
            Registro · alimento
          </p>
          <SheetTitle>{editando ? "Editar alimento" : "Adicionar alimento"}</SheetTitle>
          <SheetDescription>
            Toque num frequente para registrar direto, ou busque e escolha a medida.
          </SheetDescription>
        </SheetHeader>

        {!selecionado ? (
          <div className="flex-1 space-y-3 overflow-auto px-4">
            <Input placeholder="Buscar alimento…" value={termo}
              onChange={(e) => setTermo(e.target.value)} autoFocus />

            {termo ? (
              <ul className="space-y-0.5">
                {resultados.map((f) => (
                  <li key={f.id}>
                    <button className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                      onClick={() => setSelecionado(f)}>
                      {f.nome} <span className="font-mono text-xs text-muted-foreground">
                        · {Math.round(f.kcal)} kcal / {formatarNumero(f.base_qty_g)} {f.base_unit}
                      </span>
                    </button>
                  </li>
                ))}
                {resultados.length === 0 && (
                  <li className="py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Nada encontrado
                  </li>
                )}
              </ul>
            ) : (
              <>
                <ListaRapida titulo="Frequentes neste horário" usos={frequentes} onSelecionar={setSelecionado} data={data} mealId={mealId} />
                <ListaRapida titulo="Recentes" usos={recentesSemFrequentes} onSelecionar={setSelecionado} data={data} mealId={mealId} />
              </>
            )}
          </div>
        ) : precisaDesambiguar ? (
          <div className="flex-1 px-4">
            <DesambiguarPof
              foodId={selecionado.id} foodNome={selecionado.nome}
              baseUnit={selecionado.base_unit} onResolvido={() => setIniciadoPara(null)}
            />
            <Button variant="secondary" className="mt-3" onClick={limpar}>Voltar</Button>
          </div>
        ) : (
          <div className="flex-1 space-y-4 px-4">
            <p className="font-medium">{selecionado.nome}</p>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <div>
                <Label htmlFor="qtd">Quantidade</Label>
                <Input id="qtd" inputMode="decimal" value={qtd}
                  onChange={(e) => setQtd(e.target.value)} autoFocus />
              </div>
              <div>
                <Label htmlFor="medida">Medida</Label>
                {/* Indexado por id, não por nome: não há UNIQUE(food_id, nome)
                    e candidatas POF compartilham nome ("concha" 140g e 35g de
                    códigos diferentes). Por nome, escolher a 2ª "concha"
                    aplicaria a grama da 1ª em silêncio. */}
                <select
                  id="medida" value={measureId}
                  onChange={(e) => setMeasureId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {medidas.map((m) => (
                    <option key={m.id} value={String(m.id)}>{m.nome}</option>
                  ))}
                  <option value={BASE}>{selecionado.base_unit}</option>
                </select>
              </div>
            </div>

            {medida && qtdN > 0 && (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                {formatarNumero(qtdN)} {pluralizar(medida.nome, qtdN)} ={" "}
                {formatarNumero(qtyG)} {selecionado.base_unit}
              </p>
            )}

            {preview && (
              <p className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                {Math.round(preview.kcal)} kcal · P {Math.round(preview.prot_g)}g ·
                C {Math.round(preview.carb_g)}g · G {Math.round(preview.gord_g)}g
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => (editando ? onClose() : limpar())}>Voltar</Button>
              <Button className="flex-1" onClick={registrar}
                disabled={qtyG <= 0 || add.isPending || upd.isPending}>
                {editando ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Frequentes/recentes com [+] de 1 toque: registra a porção da última vez sem
 * abrir a 2ª tela. É o caminho de 2 toques total do spec (D6).
 */
function ListaRapida({
  titulo, usos, onSelecionar, data, mealId,
}: {
  titulo: string;
  usos: UsoFrequente[];
  onSelecionar: (f: Food) => void;
  data: string;
  mealId: number | null;
}) {
  const add = useAddEntry();
  const { data: foods } = useFoodsByIds(usos.map((u) => u.food_id));
  const { data: medidasPorFood } = useMeasuresByFoodIds(usos.map((u) => u.food_id));

  // Espera `foods` carregar antes de mostrar QUALQUER coisa, título incluso.
  // `usos` já vem pronto (useFrequentes deriva de um histórico que carrega
  // antes), mas o nome de cada alimento é uma query separada (useFoodsByIds)
  // que dispara só depois — sem este guard, "Frequentes neste horário"
  // aparece um frame antes da lista, e um teste que espera pelo título e na
  // sequência lê o nome do alimento (sem esperar de novo) pega a lista vazia.
  if (usos.length === 0 || !foods) return null;

  return (
    <div className="space-y-1">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-primary/70">{titulo}</p>
      <ul className="space-y-0.5">
        {usos.map((u) => {
          const f = foods?.get(u.food_id);
          if (!f) return null;
          const m = medidasPorFood?.get(u.food_id)?.find((x) => x.id === u.measure_id) ?? null;
          const rotulo = m && u.measure_count != null
            ? `${formatarNumero(u.measure_count)} ${pluralizar(m.nome, u.measure_count)}`
            : `${formatarNumero(u.qty_g)} ${f.base_unit}`;
          return (
            <li key={u.food_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
              <button type="button" onClick={() => onSelecionar(f)} className="flex-1 truncate text-left hover:text-primary">
                {f.nome} <span className="font-mono text-xs text-muted-foreground">· {rotulo}</span>
              </button>
              <button
                type="button"
                aria-label={`adicionar ${f.nome}`}
                disabled={add.isPending}
                onClick={() => add.mutate({
                  data, meal_id: mealId, food_id: u.food_id, qty_g: u.qty_g,
                  measure_id: u.measure_id, measure_count: u.measure_count,
                  label: mealId === null ? "Avulsa" : null,
                })}
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
