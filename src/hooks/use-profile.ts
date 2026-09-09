import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

import type { Profile } from "../domain/types";

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: ["profile"], queryFn: () => api["profile"].getProfile() });
}

export function useSaveProfile() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<Profile, "id" | "updated_at">) => api["profile"].upsertProfile(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
