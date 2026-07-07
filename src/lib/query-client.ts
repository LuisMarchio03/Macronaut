import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

let onUnauthorized: () => void = () => {};

// Permite que o AuthProvider registre o handler de logout global.
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

// Reconhece erros de autenticação (401, token expirado etc.) pela mensagem.
export function isAuthError(e: unknown): boolean {
  return e instanceof Error && /\b401\b|unauthor|expired|invalid token|authentication/i.test(e.message);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => { if (isAuthError(e)) onUnauthorized(); } }),
  mutationCache: new MutationCache({ onError: (e) => { if (isAuthError(e)) onUnauthorized(); } }),
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
