import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { canView } from "../types/auth";

/** Blocks a route the signed-in role has no `<module>.view` grant for —
 * the backend already rejects the underlying API calls either way
 * (CLAUDE.md §9), this just stops the page from rendering at all instead of
 * loading into a wall of 403s. Nav hides these same routes; this covers
 * someone typing/bookmarking the URL directly. */
export function RequireModule({ module, children }: { module: string; children: ReactNode }) {
  const { user } = useAuth();

  if (!canView(user, module)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access restricted"
        description="Your role doesn't have access to this section. Contact your hospital administrator if you believe this is a mistake."
      />
    );
  }

  return <>{children}</>;
}
