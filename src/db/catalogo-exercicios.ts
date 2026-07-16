import type { Cadeia, Equipamento, Regiao, TipoExercicio } from "../domain/types";

export interface GrupoSeed {
  nome: string;
  regiao: Regiao;
  cadeia: Cadeia | null;
}

/**
 * `cadeia` é NULL nos inferiores e no core de propósito: push/pull só é uma
 * divisão honesta no tronco. A análise de equilíbrio (Fase 3) mede só onde o
 * conceito existe.
 */
export const GRUPOS = [
  { nome: "Peito",       regiao: "superior", cadeia: "push" },
  { nome: "Costas",      regiao: "superior", cadeia: "pull" },
  { nome: "Ombros",      regiao: "superior", cadeia: "push" },
  { nome: "Bíceps",      regiao: "superior", cadeia: "pull" },
  { nome: "Tríceps",     regiao: "superior", cadeia: "push" },
  { nome: "Antebraço",   regiao: "superior", cadeia: "pull" },
  { nome: "Trapézio",    regiao: "superior", cadeia: "pull" },
  { nome: "Quadríceps",  regiao: "inferior", cadeia: null },
  { nome: "Posterior",   regiao: "inferior", cadeia: null },
  { nome: "Glúteos",     regiao: "inferior", cadeia: null },
  { nome: "Panturrilha", regiao: "inferior", cadeia: null },
  { nome: "Core",        regiao: "core",     cadeia: null },
] as const satisfies readonly GrupoSeed[];

export type NomeGrupo = (typeof GRUPOS)[number]["nome"];

export interface ItemCatalogo {
  nome: string;
  grupo: NomeGrupo;
  tipo: TipoExercicio;
  equipamento: Equipamento;
}

/**
 * Catálogo global (`source='catalogo'`, `user_id` NULL). O tipo `NomeGrupo`
 * transforma um erro de digitação em `grupo` em erro de build, em vez de linha
 * órfã no banco.
 */
export const CATALOGO: readonly ItemCatalogo[] = [
  // Peito
  { nome: "Supino reto com barra",          grupo: "Peito", tipo: "composto", equipamento: "barra" },
  { nome: "Supino inclinado com barra",     grupo: "Peito", tipo: "composto", equipamento: "barra" },
  { nome: "Supino declinado com barra",     grupo: "Peito", tipo: "composto", equipamento: "barra" },
  { nome: "Supino reto com halteres",       grupo: "Peito", tipo: "composto", equipamento: "halter" },
  { nome: "Supino inclinado com halteres",  grupo: "Peito", tipo: "composto", equipamento: "halter" },
  { nome: "Supino na máquina",              grupo: "Peito", tipo: "composto", equipamento: "maquina" },
  { nome: "Crucifixo reto com halteres",    grupo: "Peito", tipo: "isolado",  equipamento: "halter" },
  { nome: "Crucifixo inclinado com halteres", grupo: "Peito", tipo: "isolado", equipamento: "halter" },
  { nome: "Crossover na polia",             grupo: "Peito", tipo: "isolado",  equipamento: "polia" },
  { nome: "Peck deck",                      grupo: "Peito", tipo: "isolado",  equipamento: "maquina" },
  { nome: "Flexão de braço",                grupo: "Peito", tipo: "composto", equipamento: "peso_corporal" },
  { nome: "Paralelas",                      grupo: "Peito", tipo: "composto", equipamento: "peso_corporal" },

  // Costas
  { nome: "Barra fixa pronada",             grupo: "Costas", tipo: "composto", equipamento: "peso_corporal" },
  { nome: "Barra fixa supinada",            grupo: "Costas", tipo: "composto", equipamento: "peso_corporal" },
  { nome: "Puxada frontal na polia",        grupo: "Costas", tipo: "composto", equipamento: "polia" },
  { nome: "Puxada supinada na polia",       grupo: "Costas", tipo: "composto", equipamento: "polia" },
  { nome: "Remada curvada com barra",       grupo: "Costas", tipo: "composto", equipamento: "barra" },
  { nome: "Remada cavalinho",               grupo: "Costas", tipo: "composto", equipamento: "barra" },
  { nome: "Remada unilateral com halter",   grupo: "Costas", tipo: "composto", equipamento: "halter" },
  { nome: "Remada baixa na polia",          grupo: "Costas", tipo: "composto", equipamento: "polia" },
  { nome: "Remada na máquina",              grupo: "Costas", tipo: "composto", equipamento: "maquina" },
  { nome: "Pullover na polia",              grupo: "Costas", tipo: "isolado",  equipamento: "polia" },

  // Ombros
  { nome: "Desenvolvimento militar com barra", grupo: "Ombros", tipo: "composto", equipamento: "barra" },
  { nome: "Desenvolvimento com halteres",   grupo: "Ombros", tipo: "composto", equipamento: "halter" },
  { nome: "Desenvolvimento Arnold",         grupo: "Ombros", tipo: "composto", equipamento: "halter" },
  { nome: "Desenvolvimento na máquina",     grupo: "Ombros", tipo: "composto", equipamento: "maquina" },
  { nome: "Remada alta com barra",          grupo: "Ombros", tipo: "composto", equipamento: "barra" },
  { nome: "Elevação lateral com halteres",  grupo: "Ombros", tipo: "isolado",  equipamento: "halter" },
  { nome: "Elevação lateral na polia",      grupo: "Ombros", tipo: "isolado",  equipamento: "polia" },
  { nome: "Elevação frontal com halteres",  grupo: "Ombros", tipo: "isolado",  equipamento: "halter" },
  { nome: "Crucifixo inverso com halteres", grupo: "Ombros", tipo: "isolado",  equipamento: "halter" },
  { nome: "Crucifixo inverso na máquina",   grupo: "Ombros", tipo: "isolado",  equipamento: "maquina" },

  // Trapézio
  { nome: "Encolhimento com barra",         grupo: "Trapézio", tipo: "isolado", equipamento: "barra" },
  { nome: "Encolhimento com halteres",      grupo: "Trapézio", tipo: "isolado", equipamento: "halter" },

  // Bíceps
  { nome: "Rosca direta com barra",         grupo: "Bíceps", tipo: "isolado", equipamento: "barra" },
  { nome: "Rosca direta com barra W",       grupo: "Bíceps", tipo: "isolado", equipamento: "barra" },
  { nome: "Rosca alternada com halteres",   grupo: "Bíceps", tipo: "isolado", equipamento: "halter" },
  { nome: "Rosca martelo",                  grupo: "Bíceps", tipo: "isolado", equipamento: "halter" },
  { nome: "Rosca concentrada",              grupo: "Bíceps", tipo: "isolado", equipamento: "halter" },
  { nome: "Rosca inclinada com halteres",   grupo: "Bíceps", tipo: "isolado", equipamento: "halter" },
  { nome: "Rosca scott",                    grupo: "Bíceps", tipo: "isolado", equipamento: "barra" },
  { nome: "Rosca na polia",                 grupo: "Bíceps", tipo: "isolado", equipamento: "polia" },

  // Tríceps
  { nome: "Supino fechado",                 grupo: "Tríceps", tipo: "composto", equipamento: "barra" },
  { nome: "Mergulho no banco",              grupo: "Tríceps", tipo: "composto", equipamento: "peso_corporal" },
  { nome: "Tríceps testa com barra W",      grupo: "Tríceps", tipo: "isolado",  equipamento: "barra" },
  { nome: "Tríceps na polia com barra",     grupo: "Tríceps", tipo: "isolado",  equipamento: "polia" },
  { nome: "Tríceps na polia com corda",     grupo: "Tríceps", tipo: "isolado",  equipamento: "polia" },
  { nome: "Tríceps francês com halter",     grupo: "Tríceps", tipo: "isolado",  equipamento: "halter" },
  { nome: "Tríceps coice",                  grupo: "Tríceps", tipo: "isolado",  equipamento: "halter" },

  // Antebraço
  { nome: "Rosca de punho com barra",       grupo: "Antebraço", tipo: "isolado", equipamento: "barra" },
  { nome: "Rosca inversa com barra",        grupo: "Antebraço", tipo: "isolado", equipamento: "barra" },

  // Quadríceps
  { nome: "Agachamento livre",              grupo: "Quadríceps", tipo: "composto", equipamento: "barra" },
  { nome: "Agachamento frontal",            grupo: "Quadríceps", tipo: "composto", equipamento: "barra" },
  { nome: "Agachamento no Smith",           grupo: "Quadríceps", tipo: "composto", equipamento: "maquina" },
  { nome: "Agachamento hack",               grupo: "Quadríceps", tipo: "composto", equipamento: "maquina" },
  { nome: "Leg press 45°",                  grupo: "Quadríceps", tipo: "composto", equipamento: "maquina" },
  { nome: "Afundo com halteres",            grupo: "Quadríceps", tipo: "composto", equipamento: "halter" },
  { nome: "Búlgaro com halteres",           grupo: "Quadríceps", tipo: "composto", equipamento: "halter" },
  { nome: "Cadeira extensora",              grupo: "Quadríceps", tipo: "isolado",  equipamento: "maquina" },

  // Posterior
  // Terra convencional fica em Posterior, não em Costas: eretores, glúteo e
  // posterior fazem o trabalho; os lats só estabilizam. Em Costas ele contaria
  // zero série efetiva pra Posterior na análise. Decisão do usuário, 2026-07-16.
  { nome: "Levantamento terra",             grupo: "Posterior", tipo: "composto", equipamento: "barra" },
  { nome: "Stiff com barra",                grupo: "Posterior", tipo: "composto", equipamento: "barra" },
  { nome: "Levantamento terra romeno",      grupo: "Posterior", tipo: "composto", equipamento: "barra" },
  { nome: "Mesa flexora",                   grupo: "Posterior", tipo: "isolado",  equipamento: "maquina" },
  { nome: "Cadeira flexora",                grupo: "Posterior", tipo: "isolado",  equipamento: "maquina" },
  { nome: "Flexora em pé na polia",         grupo: "Posterior", tipo: "isolado",  equipamento: "polia" },

  // Glúteos
  { nome: "Elevação pélvica com barra",     grupo: "Glúteos", tipo: "composto", equipamento: "barra" },
  { nome: "Coice na polia",                 grupo: "Glúteos", tipo: "isolado",  equipamento: "polia" },
  { nome: "Abdução na máquina",             grupo: "Glúteos", tipo: "isolado",  equipamento: "maquina" },

  // Panturrilha
  { nome: "Panturrilha em pé na máquina",   grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina" },
  { nome: "Panturrilha sentado na máquina", grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina" },
  { nome: "Panturrilha no leg press",       grupo: "Panturrilha", tipo: "isolado", equipamento: "maquina" },

  // Core
  { nome: "Abdominal supra no solo",        grupo: "Core", tipo: "isolado", equipamento: "peso_corporal" },
  { nome: "Abdominal na polia",             grupo: "Core", tipo: "isolado", equipamento: "polia" },
  { nome: "Prancha",                        grupo: "Core", tipo: "isolado", equipamento: "peso_corporal" },
  { nome: "Elevação de pernas suspenso",    grupo: "Core", tipo: "isolado", equipamento: "peso_corporal" },
  { nome: "Rotação russa",                  grupo: "Core", tipo: "isolado", equipamento: "peso_corporal" },
];
