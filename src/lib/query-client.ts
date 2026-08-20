import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { registrarFalha } from "./falhas";

let onUnauthorized: () => void = () => {};

// Permite que o AuthProvider registre o handler de logout global.
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

// Reconhece erros de autenticação (401, token expirado etc.) pela mensagem.
export function isAuthError(e: unknown): boolean {
  return e instanceof Error && /\b401\b|unauthor|expired|invalid token|authentication/i.test(e.message);
}

/**
 * Marque uma mutation ou query com `meta: TRATADO_NA_TELA` quando a própria
 * tela já mostrar a falha ao lado do controle que o usuário acionou.
 */
export const TRATADO_NA_TELA = { tratadoNaTela: true } as const;

/**
 * Erro de autenticação desloga; qualquer outro vira aviso na tela.
 *
 * Antes, o `onError` só tratava o caso de auth e engolia o resto — uma
 * escrita que falhava (banco sem a tabela, rede fora) simplesmente não
 * acontecia, sem uma palavra ao usuário nem no console.
 */
function tratarFalha(e: unknown, meta?: Record<string, unknown>): void {
  if (isAuthError(e)) {
    onUnauthorized();
    return;
  }
  // A tela já mostra essa falha; o banner global seria a mesma frase duas vezes.
  if (meta?.tratadoNaTela === true) return;
  registrarFalha(e);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (e, query) => tratarFalha(e, query.meta),
  }),
  mutationCache: new MutationCache({
    onError: (e, _vars, _ctx, mutation) => tratarFalha(e, mutation.meta),
  }),
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
