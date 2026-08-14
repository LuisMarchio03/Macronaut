import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

/**
 * O padrão do Testing Library para `findBy*`/`waitFor` é 1000ms.
 *
 * Os testes de componente aqui montam um banco libSQL `:memory:`, aplicam o
 * schema e só então o TanStack Query resolve a primeira consulta — medido em
 * 742–1606ms nesta base, com a variação vindo do custo de transformação do
 * Vite, não do código sob teste. Com 1000ms o resultado passava a depender de
 * quão ocupada a máquina estava, e testes corretos falhavam de forma
 * intermitente.
 *
 * O que está sendo verificado é que a opção *eventualmente* renderiza, não que
 * ela renderize em menos de um segundo. Uma janela maior mede a asserção certa.
 */
configure({ asyncUtilTimeout: 8000 });
