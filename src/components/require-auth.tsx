import { useMemo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { DbProvider } from "../lib/db-context";
import { criarApiRemota } from "../lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const api = useMemo(
    () => (session ? criarApiRemota(session.token) : null),
    [session?.token],
  );

  if (!session || !api) return <Navigate to="/login" replace />;
  return (
    <DbProvider api={api} userId={session.userId}>
      {children}
    </DbProvider>
  );
}
