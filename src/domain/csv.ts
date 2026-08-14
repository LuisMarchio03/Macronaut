import type { Grade } from "./plano-types";

/**
 * CSV segundo a RFC 4180: campo entre aspas pode conter o separador, quebra de
 * linha e aspas duplicadas (`""`).
 *
 * São ~50 linhas e evitam uma dependência que carregaria um parser genérico
 * inteiro no bundle para ler três arquivos de estrutura conhecida.
 */
export function parseCsv(entrada: string, separador?: string): Grade {
  const texto = entrada.replace(/^﻿/, ""); // BOM do Excel
  const sep = separador ?? detectarSeparador(texto);

  // Acumula como texto puro; a conversão para `Celula` acontece no fim.
  const grade: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      entreAspas = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      campo = "";
      grade.push(linha);
      linha = [];
    } else if (c === "\r") {
      // Consumido junto com o \n do CRLF.
    } else {
      campo += c;
    }
  }

  // Último campo, se o arquivo não termina em quebra de linha.
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    grade.push(linha);
  }

  // Célula vazia vira `null`, igual ao que o leitor de xlsx entrega — os
  // parsers do plano recebem a mesma forma vindo de qualquer formato.
  return grade.map((l) => l.map((c) => (c.trim() === "" ? null : c.trim())));
}

/**
 * Excel em português exporta com ponto-e-vírgula, porque a vírgula é o
 * separador decimal. Adivinhar errado transformaria a planilha inteira numa
 * coluna só.
 */
export function detectarSeparador(texto: string): string {
  const primeiraLinha = texto.slice(0, texto.indexOf("\n") + 1 || texto.length);
  const foraDeAspas = primeiraLinha.replace(/"[^"]*"/g, "");
  const virgulas = (foraDeAspas.match(/,/g) ?? []).length;
  const pontoEVirgulas = (foraDeAspas.match(/;/g) ?? []).length;
  const tabs = (foraDeAspas.match(/\t/g) ?? []).length;

  if (tabs > virgulas && tabs > pontoEVirgulas) return "\t";
  return pontoEVirgulas > virgulas ? ";" : ",";
}
