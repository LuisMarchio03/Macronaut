import { Routes, Route, Outlet, useLocation } from "react-router-dom";
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
import { TreinoSessao } from "./pages/treino-sessao";
import { TreinoPrograma } from "./pages/treino-programa";
import { TreinoProgressao } from "./pages/treino-progressao";
import { TreinoHistorico } from "./pages/treino-historico";
import { TreinoExercicios } from "./pages/treino-exercicios";
import { TreinoCardio } from "./pages/treino-cardio";
import { Analise } from "./pages/analise";
import { Ajustes } from "./pages/ajustes";
import { Ia } from "./pages/ia";
import { Mais } from "./pages/mais";
import { Plano } from "./pages/plano";
import { PlanoImportar } from "./pages/plano-importar";
import { Login } from "./pages/login";

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
          <Route path="/treino" element={<Treino />} />
          <Route path="/treino/programa" element={<TreinoPrograma />} />
          <Route path="/treino/progressao" element={<TreinoProgressao />} />
          <Route path="/treino/historico" element={<TreinoHistorico />} />
          <Route path="/treino/exercicios" element={<TreinoExercicios />} />
          <Route path="/treino/cardio" element={<TreinoCardio />} />
          <Route path="/analise" element={<Analise />} />
          <Route path="/mais" element={<Mais />} />
          <Route path="/alimentos" element={<Foods />} />
          <Route path="/refeicoes" element={<MealsConfig />} />
          <Route path="/metas" element={<Onboarding />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/ia" element={<Ia />} />
          <Route path="/plano" element={<Plano />} />
          <Route path="/plano/importar" element={<PlanoImportar />} />
        </Route>
      </Routes>
    </>
  );
}
