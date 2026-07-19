export type Sexo = "M" | "F";
export type Objetivo = "bulk" | "cut" | "manutencao";
export type RitmoEmagrecimento = "leve" | "moderado" | "intenso" | "agressivo";
export type FoodSource = "taco" | "custom";
export type FoodUnit = "g" | "ml" | "un";

export interface Macros {
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
}

export interface Profile {
  id: number;
  sexo: Sexo;
  data_nascimento: string; // YYYY-MM-DD
  altura_cm: number;
  peso_kg: number;
  fator_atividade: number;
  objetivo: Objetivo;
  meta_kcal: number;
  meta_prot_g: number;
  meta_carb_g: number;
  meta_gord_g: number;
  updated_at: string;
}

export interface Food {
  id: number;
  nome: string;
  source: FoodSource;
  marca: string | null;
  base_qty_g: number;
  base_unit: FoodUnit;
  default_measure_id: number | null;
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
  fibra_g: number | null;
  sodio_mg: number | null;
  categoria: string | null;
  created_at: string;
}

export type SourceMedida = "pof" | "manual";
export type StatusMedida = "confirmada" | "candidata" | "descartada";

export interface FoodMeasure {
  id: number;
  food_id: number;
  nome: string;
  qty_base: number; // quanto 1 medida vale na base_unit do alimento
  ordem: number;
  source: SourceMedida;
  status: StatusMedida;
  pof_codigo: string | null;
  pof_descricao: string | null; // nome cru da POF ("FEIJAO CARIOCA · CROZIDO(A)"), p/ a desambiguação
}

export interface Meal {
  id: number;
  nome: string;
  horario: string | null; // "HH:MM"
  ordem: number;
}

export interface FoodEntry {
  id: number;
  data: string; // YYYY-MM-DD
  meal_id: number | null;
  food_id: number;
  qty_g: number;
  measure_id: number | null;
  measure_count: number | null;
  label: string | null;
  created_at: string;
}

export type TipoSerie = "aquecimento" | "valida" | "drop" | "falha";
export type ExerciseSource = "catalogo" | "custom";
export type TipoExercicio = "composto" | "isolado";
export type Equipamento = "barra" | "halter" | "maquina" | "polia" | "peso_corporal";
export type Regiao = "superior" | "inferior" | "core";
export type Cadeia = "push" | "pull";

export interface MuscleGroup {
  id: number;
  nome: string;
  regiao: Regiao;
  cadeia: Cadeia | null;
}

export interface Exercise {
  id: number;
  user_id: number | null; // null = catálogo global
  nome: string;
  grupo_muscular: string | null; // LEGADO: não escrever
  grupo_id: number | null;
  grupo_nome: string | null; // via LEFT JOIN em muscle_groups
  source: ExerciseSource;
  tipo: TipoExercicio | null;
  equipamento: Equipamento | null;
  created_at: string;
}

export interface WorkoutSession {
  id: number;
  data: string; // YYYY-MM-DD
  nome: string | null;
  nota: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  ordem: number;
  reps: number;
  peso_kg: number;
  tipo: TipoSerie;
  rir: number | null; // 0..4, onde 4 = "4 ou mais"
  nota: string | null;
  created_at: string;
}

export interface ActivityType {
  id: number;
  nome: string;
  met: number;
}

export interface ActivitySession {
  id: number;
  data: string; // YYYY-MM-DD
  tipo: string;
  duracao_min: number;
  kcal: number;
  created_at: string;
}

export interface ProgressoPonto {
  data: string;
  topPeso: number;
  e1RM: number;
  volume: number;
}

export interface MealTemplate {
  id: number;
  nome: string;
  meal_id: number | null;
  created_at: string;
}

export interface MealTemplateWithKcal extends MealTemplate {
  total_kcal: number;
}

export interface MealTemplateItem {
  id: number;
  template_id: number;
  food_id: number;
  qty_g: number;
  measure_id: number | null;
  measure_count: number | null;
  ordem: number;
}
