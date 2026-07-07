import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { getProfile, upsertProfile } from "../repositories/profile";
import type { Profile } from "../domain/types";

export function useProfile() {
  const db = useDb();
  return useQuery({ queryKey: ["profile"], queryFn: () => getProfile(db) });
}

export function useSaveProfile() {
  const db = useDb();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<Profile, "id" | "updated_at">) => upsertProfile(db, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
