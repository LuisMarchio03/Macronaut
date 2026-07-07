import { Routes, Route } from "react-router-dom";
import { BottomNav } from "./components/bottom-nav";
import { Dashboard } from "./pages/dashboard";
import { Foods } from "./pages/foods";
import { MealsConfig } from "./pages/meals-config";
import { Onboarding } from "./pages/onboarding";
import { Treino } from "./pages/treino";

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/alimentos" element={<Foods />} />
        <Route path="/refeicoes" element={<MealsConfig />} />
        <Route path="/metas" element={<Onboarding />} />
        <Route path="/treino" element={<Treino />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
