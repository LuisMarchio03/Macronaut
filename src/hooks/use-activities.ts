import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

export function useActivityTypes() {
  const api = useApi();
  return useQuery({ queryKey: ["activity-types"], queryFn: () => api["activities"].listActivityTypes() });
}

export function useActivitySessions() {
  const api = useApi();
  return useQuery({ queryKey: ["activity-sessions"], queryFn: () => api["activities"].listActivitySessions() });
}

export function useCreateActivity() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { data: string; tipo: string; duracao_min: number; kcal: number }) =>
      api["activities"].createActivitySession(a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}

export function useDeleteActivity() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api["activities"].deleteActivitySession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-sessions"] }),
  });
}
