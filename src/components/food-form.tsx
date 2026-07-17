import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { TacoAutocomplete } from "./taco-autocomplete";
import { EditorMedidas } from "./editor-medidas";
import type { Food, FoodUnit } from "../domain/types";
import type { TacoItem } from "../domain/taco";

type FoodInput = Omit<Food, "id" | "source" | "created_at">;

const UNIDADES: { valor: FoodUnit; rotulo: string }[] = [
  { valor: "g", rotulo: "g — gramas" },
  { valor: "ml", rotulo: "ml — mililitros" },
  { valor: "un", rotulo: "un — unidades" },
];

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function FoodForm({
  inicial, onSalvar, onCancelar,
}: { inicial?: Food; onSalvar: (f: FoodInput) => void; onCancelar: () => void }) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [marca, setMarca] = useState(inicial?.marca ?? "");
  const [base, setBase] = useState(String(inicial?.base_qty_g ?? 100));
  const [baseUnit, setBaseUnit] = useState<FoodUnit>(inicial?.base_unit ?? "g");
  const [kcal, setKcal] = useState(String(inicial?.kcal ?? ""));
  const [prot, setProt] = useState(String(inicial?.prot_g ?? ""));
  const [carb, setCarb] = useState(String(inicial?.carb_g ?? ""));
  const [gord, setGord] = useState(String(inicial?.gord_g ?? ""));
  const [fibra, setFibra] = useState(inicial?.fibra_g != null ? String(inicial.fibra_g) : "");
  const [sodio, setSodio] = useState(inicial?.sodio_mg != null ? String(inicial.sodio_mg) : "");

  const valido = nome.trim() && Number(base) > 0 && kcal !== "";

  function preencher(it: TacoItem) {
    setNome(it.nome);
    setBase(String(it.base_qty_g));
    setKcal(String(it.kcal));
    setProt(String(it.prot_g));
    setCarb(String(it.carb_g));
    setGord(String(it.gord_g));
    if (it.fibra_g != null) setFibra(String(it.fibra_g));
    if (it.sodio_mg != null) setSodio(String(it.sodio_mg));
  }

  return (
    <div className="space-y-3">
      <div><Label htmlFor="nome">Nome</Label>
        <TacoAutocomplete
          id="nome" value={nome} placeholder="Buscar na TACO ou digitar…"
          onChange={setNome} onSelecionar={preencher}
        /></div>
      <div><Label htmlFor="marca">Marca (opcional)</Label>
        <Input id="marca" value={marca} onChange={(e) => setMarca(e.target.value)} /></div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="base">Base</Label>
          <Input id="base" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} /></div>
        <div><Label htmlFor="base-unit">Unidade base</Label>
          <select
            id="base-unit" value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value as FoodUnit)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.rotulo}</option>)}
          </select></div>
        <div><Label htmlFor="kcal">kcal</Label>
          <Input id="kcal" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
        <div><Label htmlFor="prot">Proteína (g)</Label>
          <Input id="prot" inputMode="decimal" value={prot} onChange={(e) => setProt(e.target.value)} /></div>
        <div><Label htmlFor="carb">Carbo (g)</Label>
          <Input id="carb" inputMode="decimal" value={carb} onChange={(e) => setCarb(e.target.value)} /></div>
        <div><Label htmlFor="gord">Gordura (g)</Label>
          <Input id="gord" inputMode="decimal" value={gord} onChange={(e) => setGord(e.target.value)} /></div>
        <div><Label htmlFor="fibra">Fibra (g)</Label>
          <Input id="fibra" inputMode="decimal" value={fibra} onChange={(e) => setFibra(e.target.value)} /></div>
        <div><Label htmlFor="sodio">Sódio (mg)</Label>
          <Input id="sodio" inputMode="decimal" value={sodio} onChange={(e) => setSodio(e.target.value)} /></div>
      </div>

      {/* Medidas precisam do food_id, que só existe depois de salvar. */}
      {inicial && <EditorMedidas foodId={inicial.id} baseUnit={baseUnit} />}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
        <Button className="flex-1" disabled={!valido} onClick={() => onSalvar({
          nome: nome.trim(), marca: marca.trim() || null,
          base_qty_g: Number(base), base_unit: baseUnit,
          default_measure_id: inicial?.default_measure_id ?? null,
          kcal: Number(kcal), prot_g: Number(prot), carb_g: Number(carb), gord_g: Number(gord),
          fibra_g: num(fibra), sodio_mg: num(sodio),
          categoria: inicial?.categoria ?? null,
        })}>Salvar</Button>
      </div>
    </div>
  );
}
