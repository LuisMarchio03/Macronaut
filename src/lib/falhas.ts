import { useSyncExternalStore } from "react";
import { traduzirErro, type FalhaLegivel } from "@/domain/erros";

/**
 * Fila de falhas que precisam chegar ao usuário.
 *
 * Vive fora do React porque quem as produz é o `MutationCache` do TanStack
 * Query, criado como singleton de módulo, antes de existir qualquer componente.
 */

export interface FalhaVisivel extends FalhaLegivel {
  id: number;
}

let fila: FalhaVisivel[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();

function notificar() {
  for (const o of ouvintes) o();
}

export function registrarFalha(e: unknown): void {
  const f = { id: proximoId++, ...traduzirErro(e) };
  // A mesma falha repetida (o usuário insistindo no botão) não vira uma pilha
  // de avisos idênticos.
  fila = [...fila.filter((x) => x.original !== f.original), f];
  notificar();
}

export function descartarFalha(id: number): void {
  fila = fila.filter((f) => f.id !== id);
  notificar();
}

export function limparFalhas(): void {
  if (fila.length === 0) return;
  fila = [];
  notificar();
}

function assinar(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const vazio: FalhaVisivel[] = [];
const ler = () => fila;

export function useFalhas(): FalhaVisivel[] {
  return useSyncExternalStore(assinar, ler, () => vazio);
}

/** Só para os testes: devolve o módulo ao estado inicial. */
export function __resetFalhas(): void {
  fila = [];
  proximoId = 1;
  ouvintes.clear();
}
