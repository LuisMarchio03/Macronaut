import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * O boneco que responde "que músculo isso pega".
 *
 * Um desenho só serve o catálogo inteiro: as regiões são as MESMAS 12 de
 * `muscle_groups`, e o exercício só diz qual delas é a primária e quais são
 * secundárias. Foto ou GIF por exercício resolveria outra pergunta — "como
 * executar" —, e essa quem responde é o link de execução, sem custar rede,
 * licença nem um casamento nome→imagem que falha em metade do catálogo em
 * português.
 *
 * Desenhado com primitivas (elipse, retângulo arredondado) e não com um path
 * único por figura: um path de silhueta inteira é ilegível de manter, e aqui
 * cada peça é uma linha que se lê.
 *
 * Coordenadas em espaço LOCAL da figura (0..104 de largura, 0..176 de altura).
 * As costas são a mesma figura transladada — por isso as duas vistas escrevem
 * as regiões no mesmo sistema.
 */

type Vista = "frente" | "costas";

/** Uma região do desenho: o grupo que ela representa e onde ela fica. */
interface Regiao {
  grupo: string;
  vista: Vista;
  formas: ReactNode;
}

/** A figura sem músculo nenhum destacado — o corpo onde as regiões pousam. */
function Silhueta() {
  return (
    <g className="fill-muted">
      <ellipse cx="52" cy="16" rx="9" ry="11" />
      <rect x="48" y="24" width="8" height="9" rx="3" />
      <path d="M37,36 Q52,30 67,36 L63,68 Q63,82 60,90 L44,90 Q41,82 41,68 Z" />
      <ellipse cx="34" cy="42" rx="9" ry="8.5" />
      <ellipse cx="70" cy="42" rx="9" ry="8.5" />
      <ellipse cx="30" cy="57" rx="7" ry="13" />
      <ellipse cx="74" cy="57" rx="7" ry="13" />
      <ellipse cx="27" cy="81" rx="6" ry="13" />
      <ellipse cx="77" cy="81" rx="6" ry="13" />
      <ellipse cx="26" cy="96" rx="4.5" ry="5.5" />
      <ellipse cx="78" cy="96" rx="4.5" ry="5.5" />
      <path d="M42,86 L62,86 L63,100 L41,100 Z" />
      <rect x="42" y="97" width="10" height="38" rx="5" />
      <rect x="52" y="97" width="10" height="38" rx="5" />
      <rect x="43" y="133" width="9" height="32" rx="4.5" />
      <rect x="52" y="133" width="9" height="32" rx="4.5" />
      <ellipse cx="47" cy="167" rx="5" ry="4" />
      <ellipse cx="57" cy="167" rx="5" ry="4" />
    </g>
  );
}

/**
 * As regiões, na ordem em que são desenhadas.
 *
 * Os nomes têm de bater exatamente com `muscle_groups.nome` (ver `GRUPOS` em
 * `db/catalogo-exercicios.ts`): é por nome que o exercício aponta para a
 * região, e um acento fora do lugar apaga o destaque em silêncio.
 */
const REGIOES: readonly Regiao[] = [
  // ── frente ──
  {
    grupo: "Trapézio",
    vista: "frente",
    formas: <path d="M40,34 Q52,28 64,34 L60,40 Q52,34.5 44,40 Z" />,
  },
  {
    grupo: "Ombros",
    vista: "frente",
    formas: (
      <>
        <ellipse cx="34" cy="42" rx="8" ry="7.5" />
        <ellipse cx="70" cy="42" rx="8" ry="7.5" />
      </>
    ),
  },
  {
    grupo: "Peito",
    vista: "frente",
    formas: (
      <>
        <rect x="41.5" y="40" width="9.5" height="17" rx="4" />
        <rect x="53" y="40" width="9.5" height="17" rx="4" />
      </>
    ),
  },
  {
    grupo: "Bíceps",
    vista: "frente",
    formas: (
      <>
        <ellipse cx="30" cy="56" rx="6" ry="10" />
        <ellipse cx="74" cy="56" rx="6" ry="10" />
      </>
    ),
  },
  {
    grupo: "Core",
    vista: "frente",
    formas: <rect x="45.5" y="59" width="13" height="27" rx="4" />,
  },
  {
    grupo: "Quadríceps",
    vista: "frente",
    formas: (
      <>
        <rect x="43" y="99" width="8" height="33" rx="4" />
        <rect x="53" y="99" width="8" height="33" rx="4" />
      </>
    ),
  },

  // ── costas ──
  {
    grupo: "Trapézio",
    vista: "costas",
    formas: <path d="M38,33 Q52,27 66,33 L58,58 L52,50 L46,58 Z" />,
  },
  {
    grupo: "Ombros",
    vista: "costas",
    formas: (
      <>
        <ellipse cx="34" cy="42" rx="8" ry="7.5" />
        <ellipse cx="70" cy="42" rx="8" ry="7.5" />
      </>
    ),
  },
  {
    grupo: "Costas",
    vista: "costas",
    formas: (
      <>
        <path d="M40,48 L50,53 L50,82 Q42,74 38,60 Z" />
        <path d="M64,48 L54,53 L54,82 Q62,74 66,60 Z" />
      </>
    ),
  },
  {
    grupo: "Tríceps",
    vista: "costas",
    formas: (
      <>
        <ellipse cx="30" cy="56" rx="6" ry="10" />
        <ellipse cx="74" cy="56" rx="6" ry="10" />
      </>
    ),
  },
  {
    grupo: "Glúteos",
    vista: "costas",
    formas: (
      <>
        <rect x="41" y="84" width="10" height="15" rx="5" />
        <rect x="53" y="84" width="10" height="15" rx="5" />
      </>
    ),
  },
  {
    grupo: "Posterior",
    vista: "costas",
    formas: (
      <>
        <rect x="43" y="101" width="8" height="31" rx="4" />
        <rect x="53" y="101" width="8" height="31" rx="4" />
      </>
    ),
  },

  // ── nas duas ──
  ...(["frente", "costas"] as const).flatMap((vista) => [
    {
      grupo: "Antebraço",
      vista,
      formas: (
        <>
          <ellipse cx="27" cy="80" rx="5" ry="11" />
          <ellipse cx="77" cy="80" rx="5" ry="11" />
        </>
      ),
    },
    {
      grupo: "Panturrilha",
      vista,
      formas: (
        <>
          <rect x="44" y="137" width="7" height="27" rx="3.5" />
          <rect x="53" y="137" width="7" height="27" rx="3.5" />
        </>
      ),
    },
  ]),
];

type Realce = "primario" | "secundario" | "nenhum";

const FILL: Record<Realce, string> = {
  // O primário é a cor da marca cheia; o secundário, a mesma cor rebaixada —
  // são a mesma informação em dois pesos, não duas informações diferentes.
  primario: "fill-primary",
  secundario: "fill-primary/35",
  nenhum: "fill-transparent",
};

function Figura({
  vista,
  realceDe,
  dx,
}: {
  vista: Vista;
  realceDe: (grupo: string) => Realce;
  dx: number;
}) {
  return (
    <g transform={`translate(${dx},0)`}>
      <Silhueta />
      {REGIOES.filter((r) => r.vista === vista).map((r) => {
        const realce = realceDe(r.grupo);
        return (
          <g key={`${vista}-${r.grupo}`} data-grupo={r.grupo} data-realce={realce} className={FILL[realce]}>
            {r.formas}
          </g>
        );
      })}
      <text
        x="52"
        y="176"
        textAnchor="middle"
        className="fill-muted-foreground text-[9px]"
        style={{ fontSize: 9 }}
      >
        {vista === "frente" ? "Frente" : "Costas"}
      </text>
    </g>
  );
}

/**
 * O mapa muscular de um exercício.
 *
 * `primario` e `secundarios` são NOMES de grupo, como vêm de
 * `exercises.grupo_nome` e `exercises.musculos_secundarios`. Nome que não
 * existe no desenho simplesmente não acende — é o comportamento certo para um
 * exercício que você cadastrou com um grupo que o boneco não representa.
 */
export function MapaMuscular({
  primario,
  secundarios = [],
  className,
}: {
  primario: string | null;
  secundarios?: readonly string[];
  className?: string;
}) {
  const sec = new Set(secundarios);
  const realceDe = (grupo: string): Realce =>
    grupo === primario ? "primario" : sec.has(grupo) ? "secundario" : "nenhum";

  const legenda = primario
    ? sec.size > 0
      ? `Trabalha ${primario}, e também ${[...sec].join(", ")}`
      : `Trabalha ${primario}`
    : "Sem grupo muscular definido";

  return (
    <svg
      viewBox="0 0 200 180"
      role="img"
      aria-label={legenda}
      className={cn("w-full max-w-[220px]", className)}
    >
      <Figura vista="frente" realceDe={realceDe} dx={0} />
      <Figura vista="costas" realceDe={realceDe} dx={96} />
    </svg>
  );
}
