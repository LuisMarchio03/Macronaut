import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { HudPanel } from "../components/ui/hud-panel";
import { useProfile, useSaveProfile } from "../hooks/use-profile";
import { useAuth } from "../lib/auth-context";
import {
  idade, tmbMifflinStJeor, gastoEnergetico, ajustePorObjetivo, splitMacros,
} from "../domain/nutrition";
import type { Objetivo, Sexo } from "../domain/types";

export function Onboarding() {
  const navigate = useNavigate();
  const { data: perfil } = useProfile();
  const salvar = useSaveProfile();
  const { logout } = useAuth();

  const [sexo, setSexo] = useState<Sexo>("M");
  const [nascimento, setNascimento] = useState("");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [fator, setFator] = useState("1.55");
  const [objetivo, setObjetivo] = useState<Objetivo>("manutencao");
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

  function calcular() {
    const pesoN = Number(peso);
    const tmb = tmbMifflinStJeor({
      sexo, peso_kg: pesoN, altura_cm: Number(altura),
      idade: idade(nascimento, new Date()),
    });
    const alvo = ajustePorObjetivo(gastoEnergetico(tmb, Number(fator)), objetivo);
    const m = splitMacros(alvo, pesoN, objetivo);
    setMetaKcal(String(alvo)); setMetaProt(String(m.prot_g));
    setMetaCarb(String(m.carb_g)); setMetaGord(String(m.gord_g));
  }

  async function onSalvar() {
    await salvar.mutateAsync({
      sexo, data_nascimento: nascimento, altura_cm: Number(altura), peso_kg: Number(peso),
      fator_atividade: Number(fator), objetivo,
      meta_kcal: Number(metaKcal), meta_prot_g: Number(metaProt),
      meta_carb_g: Number(metaCarb), meta_gord_g: Number(metaGord),
    });
    navigate("/");
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1 pt-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-primary/70">
          Perfil · objetivos
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Suas metas</h1>
      </header>

      <HudPanel label="Perfil" bodyClassName="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sexo">Sexo</Label>
          <select id="sexo" className="hud-select"
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
          <Label htmlFor="fator">Fator de atividade</Label>
          <select id="fator" className="hud-select"
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
          <select id="objetivo" className="hud-select"
            value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)}>
            <option value="cut">Cutting</option>
            <option value="manutencao">Manutenção</option>
            <option value="bulk">Bulking</option>
          </select>
        </div>
      </HudPanel>

      <HudPanel label="Metas · macros" bodyClassName="space-y-4">
        <Button type="button" variant="secondary" className="w-full" onClick={calcular}>Calcular</Button>
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

        <Button type="button" className="w-full" onClick={onSalvar}
          disabled={!metaKcal || salvar.isPending}>Salvar</Button>
      </HudPanel>

      <Button type="button" variant="ghost" className="w-full" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
