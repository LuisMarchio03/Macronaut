import { Outlet } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { TabsNav, type AbaNav } from "@/components/ui/tabs-nav";
import { dataPorExtenso, hoje } from "@/lib/date";

/**
 * O treino numa tela só.
 *
 * Eram cinco rotas e uma biblioteca exilada em "Mais" — cada pergunta sobre
 * treino morava num lugar diferente, e descobrir qual exigia lembrar por onde
 * se entrava. As quatro abas são as quatro perguntas: o que eu faço hoje, o
 * que eu treino na semana, o que eu já fiz, e quais exercícios existem.
 *
 * A sessão da academia continua FORA daqui, tela cheia e sem barra: lá o
 * polegar tem uma tarefa só, e uma aba é um convite a sair dela.
 */
const ABAS: readonly AbaNav[] = [
  // A calistenia virou a quinta aba. Ela era o aprofundamento de um card que
  // aparecia DUAS vezes — no dashboard e em "Hoje" —, e um card grande com
  // estado vazio para uma coisa que talvez não aconteça hoje é muito destaque
  // para pouca informação. Como aba ela fica a um toque, e para de disputar a
  // tela com o treino do dia.
  { to: "/treino", label: "Hoje", fim: true },
  { to: "/treino/rotina", label: "Rotina" },
  { to: "/treino/progresso", label: "Progresso", alias: ["/treino/sessao"] },
  { to: "/treino/calistenia", label: "Calistenia" },
  { to: "/treino/exercicios", label: "Exercícios" },
];

export function TreinoLayout() {
  return (
    <Page>
      <PageHeader eyebrow={dataPorExtenso(hoje())} title="Treino">
        <TabsNav abas={ABAS} rotulo="Seções do treino" />
      </PageHeader>
      <Outlet />
    </Page>
  );
}
