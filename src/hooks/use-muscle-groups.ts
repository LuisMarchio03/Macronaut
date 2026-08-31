import { useQuery } from "@tanstack/react-query";
import { useApi } from "../lib/db-context";

export function useMuscleGroups() {
  const api = useApi();
  return useQuery({
    queryKey: ["muscle-groups"],
    queryFn: () => api["muscle-groups"].listMuscleGroups(),
    staleTime: Infinity, // catálogo global, não muda em runtime
  });
}
