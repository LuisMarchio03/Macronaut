import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { useAuth } from "../lib/auth-context";
import { apagarDispositivo, listarDispositivos } from "../repositories/dispositivos";

const CHAVE = ["dispositivos"] as const;

export function useDispositivos() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: CHAVE, queryFn: () => listarDispositivos(db, userId) });
}

export function useApagarDispositivo() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apagarDispositivo(db, userId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export interface CodigoDePareamento {
  codigo: string;
  expira_em: string;
}

/**
 * Pede ao servidor um código para mostrar na tela.
 *
 * É a única coisa desta tela que não passa pelo caminho normal: o banco
 * guarda o HASH do código, e o hash usa o segredo de assinatura, que o
 * navegador não tem. Listar e apagar aparelhos são consultas comuns.
 */
export function useGerarCodigo() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<CodigoDePareamento> => {
      const res = await fetch("/api/codigo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token ?? ""}`,
        },
        body: "{}",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `${res.status} ao gerar o código`);
      }
      return (await res.json()) as CodigoDePareamento;
    },
  });
}
