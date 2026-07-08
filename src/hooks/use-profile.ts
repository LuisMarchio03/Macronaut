import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDb, useUserId } from "../lib/db-context";
import { getProfile, upsertProfile } from "../repositories/profile";
import type { Profile } from "../domain/types";

export function useProfile() {
  const db = useDb();
  const userId = useUserId();
  return useQuery({ queryKey: ["profile"], queryFn: () => getProfile(db, userId) });
}

export function useSaveProfile() {
  const db = useDb();
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Omit<Profile, "id" | "updated_at">) => upsertProfile(db, userId, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
