import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Calculator, Save, TrendingDown, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Page, PageHeader } from "../components/ui/page";
import { useProfile, useSaveProfile } from "../hooks/use-profile";
import { useAuth } from "../lib/auth-context";
import {
  idade, tmbMifflinStJeor, gastoEnergetico, ajustePorObjetivo, splitMacros,
  deficitDiario, perdaSemanal, metaKcalCut, splitMacrosCut, tempoParaObjetivo,
} from "../domain/nutrition";
import type { Objetivo, RitmoEmagrecimento, Sexo } from "../domain/types";
import { cn } from "../lib/utils";

const RITMOS: { key: RitmoEmagrecimento; label: string; sub: string }[] = [
  { key: "leve", label: "Leve", sub: "0.25 kg/sem" },
  { key: "moderado", label: "Moderado", sub: "0.5 kg/sem" },
  { key: "intenso", label: "Intenso", sub: "0.75 kg/sem" },
  { key: "agressivo", label: "Agressivo", sub: "1 kg/sem" },
];

export function Onboarding() {
  const navigate = useNavigate();
  const { data: perfil } = useProfile();
  const salvar = useSaveProfile();
  const { logout } = useAuth();

  const [sexo, setSexo] = useState<Sexo>("M");
  const [nascimento, setNascimento] = useState("");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [pesoMeta, setPesoMeta] = useState("");
  const [fator, setFator] = useState("1.55");
  const [objetivo, setObjetivo] = useState<Objetivo>("manutencao");
  const [ritmo, setRitmo] = useState<RitmoEmagrecimento>("moderado");
  const [metaKcal, setMetaKcal] = useState("");
  const [metaProt, setMetaProt] = useState("");
  const [metaCarb, setMetaCarb] = useState("");
  const [metaGord, setMetaGord] = useState("");

  useEffect(() => {
    if (!perfil) return;
    setSexo(perfil.sexo); setNascimento(perfil.data_nascimento);
    setAltura(String(perfil.altura_cm)); setPeso(String(perfil.peso_kg));
    setFator(String(perfil.fator_atividade)); setObjetivo(perfil.objetivo);
    setMetaKcal(String(perfil.meta_kcal)); setMetaProt(String(perfil.meta_prot_g));
    setMetaCarb(String(perfil.meta_carb_g)); setMetaGord(String(perfil.meta_gord_g));
  }, [perfil]);

  const pesoN = Number(peso);
  const pesoMetaN = Number(pesoMeta);

  function calcular() {
    const tmb = tmbMifflinStJeor({
      sexo, peso_kg: pesoN, altura_cm: Number(altura),
      idade: idade(nascimento, new Date()),
    });
    const tdee = gastoEnergetico(tmb, Number(fator));

    if (objetivo === "cut") {
      const alvo = metaKcalCut(tdee, ritmo);
      const m = splitMacrosCut(alvo, pesoN, ritmo);
      setMetaKcal(String(alvo)); setMetaProt(String(m.prot_g));
      setMetaCarb(String(m.carb_g)); setMetaGord(String(m.gord_g));
    } else {
      const alvo = ajustePorObjetivo(tdee, objetivo);
      const m = splitMacros(alvo, pesoN, objetivo);
      setMetaKcal(String(alvo)); setMetaProt(String(m.prot_g));
      setMetaCarb(String(m.carb_g)); setMetaGord(String(m.gord_g));
    }
  }

  const tmbCalculada = pesoN && altura && nascimento
    ? tmbMifflinStJeor({ sexo, peso_kg: pesoN, altura_cm: Number(altura), idade: idade(nascimento, new Date()) })
    : 0;
  const tdeeEstimado = tmbCalculada > 0 ? gastoEnergetico(tmbCalculada, Number(fator)) : 0;
  const deficitEstimado = objetivo === "cut" && tdeeEstimado > 0 ? deficitDiario(ritmo) : 0;
  const semanasRestantes = objetivo === "cut" && pesoMetaN > 0 && pesoN > pesoMetaN
    ? tempoParaObjetivo(pesoN, pesoMetaN, ritmo)
    : 0;

  async function onSalvar() {
    await salvar.mutateAsync({
      sexo, data_nascimento: nascimento, altura_cm: Number(altura), peso_kg: pesoN,
      fator_atividade: Number(fator), objetivo,
      meta_kcal: Number(metaKcal), meta_prot_g: Number(metaProt),
      meta_carb_g: Number(metaCarb), meta_gord_g: Number(metaGord),
    });
    navigate("/");
  }

  return (
    <Page>
      <PageHeader title="Suas metas">
        <p className="t-caption">
          O app usa estes dados para calcular sua meta de calorias e a divisão de macros.
        </p>
      </PageHeader>

      <Card
        tone="primary"
        header={
          <span className="flex items-center gap-1.5">
            <Target className="size-3.5" aria-hidden /> Perfil
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sexo">Sexo</Label>
            <select id="sexo" className="select-field"
              value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
          <div>
            <Label htmlFor="nascimento">Nascimento</Label>
            <Input id="nascimento" type="date" value={nascimento}
              onChange={(e) => setNascimento(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="altura">Altura (cm)</Label>
            <Input id="altura" inputMode="numeric" value={altura}
              onChange={(e) => setAltura(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="peso">Peso (kg)</Label>
            <Input id="peso" inputMode="decimal" value={peso}
              onChange={(e) => setPeso(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fator">Atividade</Label>
            <select id="fator" className="select-field"
              value={fator} onChange={(e) => setFator(e.target.value)}>
              <option value="1.2">Sedentário (1.2)</option>
              <option value="1.375">Leve (1.375)</option>
              <option value="1.55">Moderado (1.55)</option>
              <option value="1.725">Intenso (1.725)</option>
              <option value="1.9">Muito intenso (1.9)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="objetivo">Objetivo</Label>
            <select id="objetivo" className="select-field"
              value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}>
              <option value="cut">Emagrecimento</option>
              <option value="manutencao">Manutenção</option>
              <option value="bulk">Bulking</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Ritmo de emagrecimento */}
      {objetivo === "cut" && (
        <Card
          header={
            <span className="flex items-center gap-1.5">
              <TrendingDown className="size-3.5" aria-hidden /> Ritmo de emagrecimento
            </span>
          }
          bodyClassName="space-y-4 px-4 pt-1 pb-4"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {RITMOS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRitmo(r.key)}
                aria-pressed={ritmo === r.key}
                className={cn(
                  "min-h-14 rounded-md border px-2 py-2 text-center text-[0.8125rem] transition-colors",
                  ritmo === r.key
                    ? "border-primary bg-tint-primary text-primary"
                    : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="block font-semibold">{r.label}</span>
                <span className="block text-[0.75rem] tabular-nums opacity-80">{r.sub}</span>
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="pesoMeta">Peso meta (kg)</Label>
            <Input
              id="pesoMeta"
              inputMode="decimal"
              placeholder="Ex: 75"
              value={pesoMeta}
              onChange={(e) => setPesoMeta(e.target.value)}
            />
          </div>

          {tdeeEstimado > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Gasto total (TDEE)</span>
                <span className="font-semibold tabular-nums">{Math.round(tdeeEstimado)} kcal</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Déficit diário</span>
                <span className="font-semibold tabular-nums text-destructive">-{deficitEstimado} kcal</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Meta calórica</span>
                <span className="font-semibold tabular-nums text-primary">
                  {metaKcal || Math.round(tdeeEstimado - deficitEstimado)} kcal
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Perda semanal</span>
                <span className="font-semibold tabular-nums text-success">
                  ~{perdaSemanal(ritmo)} kg
                </span>
              </div>
              {semanasRestantes > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-tint-primary px-2 py-1.5">
                  <span className="t-caption flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> Tempo até a meta
                  </span>
                  <span className="text-[0.8125rem] font-semibold tabular-nums text-primary">
                    ~{semanasRestantes} {semanasRestantes === 1 ? "semana" : "semanas"}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <Card
        header={
          <span className="flex items-center gap-1.5">
            <Calculator className="size-3.5" aria-hidden /> Metas e macros
          </span>
        }
        bodyClassName="space-y-4 px-4 pt-1 pb-4"
      >
        <Button type="button" variant="outline" block onClick={calcular}>
          <Calculator className="size-4" /> Calcular
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="metaKcal">Meta kcal</Label>
            <Input id="metaKcal" inputMode="numeric" value={metaKcal}
              onChange={(e) => setMetaKcal(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="metaProt">Proteína (g)</Label>
            <Input id="metaProt" inputMode="numeric" value={metaProt}
              onChange={(e) => setMetaProt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="metaCarb">Carbo (g)</Label>
            <Input id="metaCarb" inputMode="numeric" value={metaCarb}
              onChange={(e) => setMetaCarb(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="metaGord">Gordura (g)</Label>
            <Input id="metaGord" inputMode="numeric" value={metaGord}
              onChange={(e) => setMetaGord(e.target.value)} />
          </div>
        </div>
        <Button type="button" block onClick={onSalvar} disabled={!metaKcal || salvar.isPending}>
          <Save className="size-4" /> Salvar metas
        </Button>
      </Card>

      <Card>
        <Button type="button" variant="destructive-ghost" block onClick={logout}>
          Sair da conta
        </Button>
      </Card>
    </Page>
  );
}