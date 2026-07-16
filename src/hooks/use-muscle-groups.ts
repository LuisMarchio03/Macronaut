import { useQuery } from "@tanstack/react-query";
import { useDb } from "../lib/db-context";
import { listMuscleGroups } from "../repositories/muscle-groups";

export function useMuscleGroups() {
  const db = useDb();
  return useQuery({
    queryKey: ["muscle-groups"],
    queryFn: () => listMuscleGroups(db),
    staleTime: Infinity, // catálogo global, não muda em runtime
  });
}
