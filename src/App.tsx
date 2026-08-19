import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AvisosDeFalha } from "./components/avisos-de-falha";
import { BottomNav } from "./components/bottom-nav";
import { QuickAdd } from "./components/quick-add";
import { RequireAuth } from "./components/require-auth";
import { DataProvider } from "./lib/data-context";
import { Dashboard } from "./pages/dashboard";
import { Nutricao } from "./pages/nutricao";
import { Foods } from "./pages/foods";
import { MealsConfig } from "./pages/meals-config";
import { Onboarding } from "./pages/onboarding";
import { Treino } from "./pages/treino";
import { TreinoLayout } from "./pages/treino-layout";
import { TreinoSessao } from "./pages/treino-sessao";
import { TreinoRotina } from "./pages/treino-rotina";
import { TreinoProgresso } from "./pages/treino-progresso";
import { TreinoSessaoDetalhe } from "./pages/treino-sessao-detalhe";
import { Exercicios } from "./pages/exercicios";
import { Analise } from "./pages/analise";
import { Ajustes } from "./pages/ajustes";
import { Ia } from "./pages/ia";
import { Mais } from "./pages/mais";
import { Plano } from "./pages/plano";
import { PlanoImportar } from "./pages/plano-importar";
import { Login } from "./pages/login";
import { NaoEncontrada } from "./pages/nao-encontrada";

/** Telas onde registrar comida é a próxima ação provável. */
const COM_REGISTRO_RAPIDO = ["/", "/nutricao"];

function ProtectedLayout() {
  const { pathname } = useLocation();
  const comRegistroRapido = COM_REGISTRO_RAPIDO.includes(pathname);

  return (
    <RequireAuth>
      <DataProvider>
        {/* A folga inferior cobre a barra de navegação e, quando existe, também
            o botão flutuante — sem ela o botão fica por cima do último card e
            esconde o que está debaixo dele. */}
        <div
          className={
            comRegistroRapido
              ? "mx-auto min-h-dvh max-w-lg pb-[calc(7.5rem+env(safe-area-inset-bottom))]"
              : "mx-auto min-h-dvh max-w-lg pb-[calc(4rem+env(safe-area-inset-bottom))]"
          }
        >
          <Outlet />
          {comRegistroRapido && <QuickAdd />}
          <BottomNav />
        </div>
      </DataProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <>
      {/* Fora das rotas: uma falha de escrita precisa aparecer esteja o
          usuário em que tela estiver. */}
      <AvisosDeFalha />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Fora do layout de propósito: na academia a tela é inteira, sem
            barra de navegação puxando o polegar para outro lugar. */}
        <Route
          path="/treino/sessao"
          element={
            <RequireAuth>
              <DataProvider>
                <TreinoSessao />
              </DataProvider>
            </RequireAuth>
          }
        />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nutricao" element={<Nutricao />} />
          {/* Quatro abas, uma tela. As rotas continuam sendo o endereço de
              cada seção — é o que faz o voltar do celular funcionar e um link
              de fora abrir na aba certa. */}
          <Route path="/treino" element={<TreinoLayout />}>
            <Route index element={<Treino />} />
            <Route path="rotina" element={<TreinoRotina />} />
            <Route path="progresso" element={<TreinoProgresso />} />
            <Route path="exercicios" element={<Exercicios />} />
            {/* Detalhe de sessão vive DENTRO das abas: é conteúdo com endereço
                próprio (histórico, exclusão), não uma ação — e ficar sob a aba
                mantém "Progresso" aceso enquanto você olha uma sessão dela. */}
            <Route path="sessao/:id" element={<TreinoSessaoDetalhe />} />
          </Route>
          {/* A biblioteca virou aba do treino. O endereço antigo continua
              respondendo: ele está em atalho de PWA instalado e no histórico
              do navegador de quem já usava o app. */}
          <Route path="/exercicios" element={<Navigate to="/treino/exercicios" replace />} />
          <Route path="/analise" element={<Analise />} />
          <Route path="/mais" element={<Mais />} />
          <Route path="/alimentos" element={<Foods />} />
          <Route path="/refeicoes" element={<MealsConfig />} />
          <Route path="/metas" element={<Onboarding />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/ia" element={<Ia />} />
          <Route path="/plano" element={<Plano />} />
          <Route path="/plano/importar" element={<PlanoImportar />} />
          {/* Dentro do layout de propósito: quem se perdeu precisa da barra de
              navegação mais do que ninguém. */}
          <Route path="*" element={<NaoEncontrada />} />
        </Route>
      </Routes>
    </>
  );
}
