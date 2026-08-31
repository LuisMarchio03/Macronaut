import type * as rotina from "../repositories/rotina";

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

/** Só as funções do módulo; tipos e constantes exportados não viram operação. */
type Operacoes<M> = {
  [K in keyof M as M[K] extends (...a: never[]) => unknown ? K : never]: Remota<M[K]>;
};

export interface Api {
  rotina: Operacoes<typeof rotina>;
}

/** Como uma chamada volta do servidor: o valor, ou o erro dela. */
type Resultado = { ok: true; valor: unknown } | { ok: false; erro: string };

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
        if (r?.ok) p.resolver(r.valor);
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

  return { rotina: modulo("rotina") as Api["rotina"] };
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
