import { useMemo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { DbProvider } from "../lib/db-context";
import { createUserDb } from "../lib/db";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const client = useMemo(
    () => (session ? createUserDb(session.dbUrl, session.token) : null),
    [session?.dbUrl, session?.token],
  );

  if (!session || !client) return <Navigate to="/login" replace />;
  return <DbProvider client={client}>{children}</DbProvider>;
}
