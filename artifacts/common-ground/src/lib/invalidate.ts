import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Returns a callback that invalidates every voter-scoped query
 * (profile, matches list, and per-candidate match detail) so the UI
 * reflects mutations immediately. The generated mutation hooks do not
 * invalidate on their own.
 */
export function useInvalidateVoterData() {
  const qc = useQueryClient();
  return useCallback(
    () =>
      qc.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          (query.queryKey[0] as string).startsWith("/api/me"),
      }),
    [qc],
  );
}
