import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Faz `./x.js` encontrar `x.ts` quando o script roda direto no Node.
 *
 * Os módulos de `src/` são lidos por três coisas com regras de resolução
 * diferentes, e só uma escrita agrada as três:
 *
 * - O **Vite** (app e suíte) resolve `./x`, `./x.ts` e `./x.js` igual.
 * - A **Vercel** apaga os tipos e renomeia o arquivo para `.js`, mas NÃO toca no
 *   especificador. Só `./x.js` sobrevive; `./x` e `./x.ts` viram
 *   `ERR_MODULE_NOT_FOUND` no import, antes do handler, e a função inteira cai.
 * - O **Node com `--experimental-strip-types`** (os scripts daqui) faz o
 *   contrário: não renomeia nada, então quer `./x.ts` e não acha `./x.js`.
 *
 * A Vercel é a que não tem conserto por configuração — em produção o
 * especificador tem que ser `.js`. Este gancho paga a diferença do outro lado:
 * quando o Node procurar um `.js` relativo que não existe e houver um `.ts` com
 * o mesmo nome, ele carrega o `.ts`. Custa uma chamada de `existsSync` por
 * import e some do caminho quando o `.js` existe de verdade.
 */
registerHooks({
  resolve(especificador, contexto, seguinte) {
    if (especificador.startsWith(".") && especificador.endsWith(".js")) {
      const ts = `${new URL(especificador, contexto.parentURL).href.slice(0, -3)}.ts`;
      if (existsSync(fileURLToPath(ts))) return seguinte(ts, contexto);
    }
    return seguinte(especificador, contexto);
  },
});
