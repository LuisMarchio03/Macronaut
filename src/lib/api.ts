import type * as rotina from "../repositories/rotina";
import type * as sessao from "../repositories/sessao";
import type * as workouts from "../repositories/workouts";
import type * as progresso from "../repositories/progresso";
import type * as plano from "../repositories/plano";
import type * as entries from "../repositories/entries";
import type * as meals from "../repositories/meals";
import type * as mealTemplates from "../repositories/meal-templates";
import type * as foods from "../repositories/foods";
import type * as foodMeasures from "../repositories/food-measures";
import type * as exercises from "../repositories/exercises";
import type * as muscleGroups from "../repositories/muscle-groups";
import type * as activities from "../repositories/activities";
import type * as calistenia from "../repositories/calistenia";
import type * as profile from "../repositories/profile";
import type * as weighins from "../repositories/weighins";
import type * as water from "../repositories/water";
import type * as ai from "../repositories/ai";
import type * as dispositivos from "../repositories/dispositivos";

/**
 * O banco por operação nomeada.
 *
 * `/api/db` aceita SQL do cliente: uma sessão válida roda qualquer consulta,
 * inclusive nas linhas de outro usuário. Aqui o cliente manda um NOME, e o
 * `user_id` vem do token no servidor — o argumento não existe deste lado, e
 * é por isso que a assinatura remota tem dois parâmetros a menos que a local.
 *
 * A migração é por módulo, e as duas rotas coexistem enquanto ela acontece.
 * O ganho de segurança só se realiza quando `/api/db` puder ser desligada.
 */

/**
 * A mesma função, sem `db` e sem `userId`.
 *
 * `getRotinaAtiva(db, userId)` vira `api.rotina.getRotinaAtiva()`. O tipo sai
 * do próprio repositório por `import type`, que o build apaga — nenhum byte
 * de servidor entra no bundle, e a assinatura não pode divergir em silêncio
 * porque ela é derivada, não copiada.
 */
type Remota<F> = F extends (db: never, userId: number, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/** Sem `db`, mas COM o primeiro argumento: a operação global não tem dono. */
type RemotaGlobal<F> = F extends (db: never, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;

/**
 * As operações sem dono, por nome completo.
 *
 * Precisa ser declarado, e não inferido: em TypeScript o NOME do parâmetro não
 * participa da compatibilidade de tipos, então `(db, userId: number)` e
 * `(db, foodId: number)` são a mesma assinatura. Inferir escopo da forma
 * cortaria um argumento a mais em toda função global, calado.
 *
 * Duplicar a lista do servidor seria o tipo de coisa que diverge — por isso
 * `api-escopo.test.ts` compara esta união com o `REGISTRO` e falha se as duas
 * discordarem.
 */
type Globais =
  | `foods.${string}`
  | `food-measures.${string}`
  | "activities.listActivityTypes"
  | "muscle-groups.listMuscleGroups";

/** Só as funções do módulo; tipos e constantes exportados não viram operação. */
type Operacoes<Mod extends string, M> = {
  [K in keyof M as M[K] extends (...a: never[]) => unknown ? K : never]: `${Mod}.${K &
    string}` extends Globais
    ? RemotaGlobal<M[K]>
    : Remota<M[K]>;
};

export interface Api {
  "rotina": Operacoes<"rotina", typeof rotina>;
  "sessao": Operacoes<"sessao", typeof sessao>;
  "workouts": Operacoes<"workouts", typeof workouts>;
  "progresso": Operacoes<"progresso", typeof progresso>;
  "plano": Operacoes<"plano", typeof plano>;
  "entries": Operacoes<"entries", typeof entries>;
  "meals": Operacoes<"meals", typeof meals>;
  "meal-templates": Operacoes<"meal-templates", typeof mealTemplates>;
  "foods": Operacoes<"foods", typeof foods>;
  "food-measures": Operacoes<"food-measures", typeof foodMeasures>;
  "exercises": Operacoes<"exercises", typeof exercises>;
  "muscle-groups": Operacoes<"muscle-groups", typeof muscleGroups>;
  "activities": Operacoes<"activities", typeof activities>;
  "calistenia": Operacoes<"calistenia", typeof calistenia>;
  "profile": Operacoes<"profile", typeof profile>;
  "weighins": Operacoes<"weighins", typeof weighins>;
  "water": Operacoes<"water", typeof water>;
  "ai": Operacoes<"ai", typeof ai>;
  "dispositivos": Operacoes<"dispositivos", typeof dispositivos>;
}

/** Como uma chamada volta do servidor: o valor, ou o erro dela. */
type Resultado = { ok: true; valor: unknown } | { ok: false; erro: string };

/**
 * Desfaz a marca de `Map` que o servidor pôs.
 *
 * `Map` não atravessa JSON: vira `{}`. Sete funções de repositório devolvem um
 * (`getFoodsByIds`, `listItensPorBloco`, `aguaPorBloco`…), e pelo `/api/db`
 * isso não aparecia — o mapa era montado aqui, a partir das linhas.
 */
const MARCA_MAPA = "__mapa";

function reviver(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reviver);
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const entradas = o[MARCA_MAPA];
    if (Array.isArray(entradas)) {
      return new Map((entradas as [unknown, unknown][]).map(([k, x]) => [k, reviver(x)]));
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, reviver(x)]));
  }
  return v;
}

interface Pendente {
  chamada: { nome: string; args: unknown[] };
  resolver: (v: unknown) => void;
  rejeitar: (e: unknown) => void;
}

/**
 * Constrói o cliente sobre uma função de transporte.
 *
 * O `Proxy` existe para os nomes não serem escritos duas vezes: `api.rotina.x`
 * vira a string `"rotina.x"` sozinha. Uma lista de métodos aqui seria uma
 * segunda cópia do registro, e a que ninguém lembraria de atualizar.
 */
export function criarApi(despachar: (chamadas: Pendente["chamada"][]) => Promise<Resultado[]>): Api {
  let fila: Pendente[] = [];
  let agendado = false;

  function agendar() {
    if (agendado) return;
    agendado = true;
    // `setTimeout(0)` pelo mesmo motivo de `db-remoto`: os hooks do TanStack
    // Query disparam todos na mesma renderização, e uma macrotarefa recolhe
    // tudo o que ela enfileirou.
    setTimeout(() => {
      agendado = false;
      const lote = fila;
      fila = [];
      void enviar(lote);
    }, 0);
  }

  async function enviar(lote: Pendente[]): Promise<void> {
    if (lote.length === 0) return;
    try {
      const rs = await despachar(lote.map((p) => p.chamada));
      lote.forEach((p, i) => {
        const r = rs[i];
        // Cada chamada carrega o SEU erro: uma que falha não derruba as
        // outras, como não derrubava quando cada uma era uma requisição.
        if (r?.ok) p.resolver(reviver(r.valor));
        else p.rejeitar(new Error(r?.erro ?? "resposta incompleta do servidor"));
      });
    } catch (e) {
      // Falha de transporte derruba o lote inteiro — não há resposta nenhuma
      // para distribuir.
      lote.forEach((p) => p.rejeitar(e));
    }
  }

  function chamar(nome: string, args: unknown[]): Promise<unknown> {
    return new Promise((resolver, rejeitar) => {
      fila.push({ chamada: { nome, args }, resolver, rejeitar });
      agendar();
    });
  }

  function modulo(prefixo: string): unknown {
    return new Proxy(
      {},
      {
        get: (_alvo, prop) =>
          typeof prop === "string"
            ? (...args: unknown[]) => chamar(`${prefixo}.${prop}`, args)
            : undefined,
      },
    );
  }

  return {
    "rotina": modulo("rotina") as Api["rotina"],
    "sessao": modulo("sessao") as Api["sessao"],
    "workouts": modulo("workouts") as Api["workouts"],
    "progresso": modulo("progresso") as Api["progresso"],
    "plano": modulo("plano") as Api["plano"],
    "entries": modulo("entries") as Api["entries"],
    "meals": modulo("meals") as Api["meals"],
    "meal-templates": modulo("meal-templates") as Api["meal-templates"],
    "foods": modulo("foods") as Api["foods"],
    "food-measures": modulo("food-measures") as Api["food-measures"],
    "exercises": modulo("exercises") as Api["exercises"],
    "muscle-groups": modulo("muscle-groups") as Api["muscle-groups"],
    "activities": modulo("activities") as Api["activities"],
    "calistenia": modulo("calistenia") as Api["calistenia"],
    "profile": modulo("profile") as Api["profile"],
    "weighins": modulo("weighins") as Api["weighins"],
    "water": modulo("water") as Api["water"],
    "ai": modulo("ai") as Api["ai"],
    "dispositivos": modulo("dispositivos") as Api["dispositivos"],
  };
}

/** O cliente de produção: fala com `/api/rpc` com o bilhete da sessão. */
export function criarApiRemota(token: string, rota = "/api/rpc"): Api {
  return criarApi(async (chamadas) => {
    const res = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chamadas }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(b.error ?? `${res.status} ao falar com o servidor`);
    }
    return (await res.json()) as Resultado[];
  });
}
