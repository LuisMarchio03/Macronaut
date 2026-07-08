export type Sexo = "M" | "F";
export type Objetivo = "bulk" | "cut" | "manutencao";
export type FoodSource = "taco" | "custom";

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
  kcal: number;
  prot_g: number;
  carb_g: number;
  gord_g: number;
  created_at: string;
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
  label: string | null;
  created_at: string;
}

export interface Exercise {
  id: number;
  nome: string;
  grupo_muscular: string | null;
  created_at: string;
}

export interface WorkoutSession {
  id: number;
  data: string; // YYYY-MM-DD
  nome: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  ordem: number;
  reps: number;
  peso_kg: number;
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
