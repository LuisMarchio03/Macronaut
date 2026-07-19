import { Routes, Route, Outlet } from "react-router-dom";
import { BottomNav } from "./components/bottom-nav";
import { RequireAuth } from "./components/require-auth";
import { DataProvider } from "./lib/data-context";
import { Dashboard } from "./pages/dashboard";
import { Nutricao } from "./pages/nutricao";
import { Foods } from "./pages/foods";
import { MealsConfig } from "./pages/meals-config";
import { Onboarding } from "./pages/onboarding";
import { Treino } from "./pages/treino";
import { Analise } from "./pages/analise";
import { Ajustes } from "./pages/ajustes";
import { Ia } from "./pages/ia";
import { Mais } from "./pages/mais";
import { Login } from "./pages/login";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <DataProvider>
        <div className="mx-auto min-h-screen max-w-lg pb-24">
          <Outlet />
          <BottomNav />
        </div>
      </DataProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nutricao" element={<Nutricao />} />
        <Route path="/treino" element={<Treino />} />
        <Route path="/analise" element={<Analise />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/alimentos" element={<Foods />} />
        <Route path="/refeicoes" element={<MealsConfig />} />
        <Route path="/metas" element={<Onboarding />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="/ia" element={<Ia />} />
      </Route>
    </Routes>
  );
}