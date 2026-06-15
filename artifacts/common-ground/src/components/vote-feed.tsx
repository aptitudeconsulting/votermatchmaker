import { useMemo } from "react";
import { Link } from "wouter";
import { useGetMyVoteFeed, type VoteFeedItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, ExternalLink } from "lucide-react";

const SEEN_KEY = "vc:vote-feed:last-seen";

/** Stable signature for the newest item so we can mark the feed as "seen". */
function topSignature(items: VoteFeedItem[]): string {
  const top = items[0];
  if (!top) return "";
  return `${top.candidateId}:${top.billNumber}:${top.date ?? ""}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * In-app activity bell: surfaces recent ACTUAL roll-call floor votes cast by the
 * candidates the signed-in voter has saved to their ballot. No email — purely a
 * pull feed. The unread dot compares the newest item against a localStorage
 * "last seen" marker, so it clears once the voter opens the panel.
 */
export function VoteFeedBell() {
  const { data } = useGetMyVoteFeed();
  const items = data?.items ?? [];

  const lastSeen =
    typeof window !== "undefined" ? localStorage.getItem(SEEN_KEY) : null;
  const sig = useMemo(() => topSignature(items), [items]);
  const hasUnread = sig !== "" && sig !== lastSeen;

  function markSeen() {
    if (sig) localStorage.setItem(SEEN_KEY, sig);
  }

  return (
    <Popover onOpenChange={(open) => open && markSeen()}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Recent votes from your saved candidates"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recent floor votes</h3>
          <span className="text-xs text-muted-foreground">Saved candidates</span>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No recent votes yet. Save candidates to your ballot to follow how
              they vote on the floor.
            </p>
            <Link href="/candidates">
              <Button variant="outline" size="sm" className="mt-3">
                Browse candidates
              </Button>
            </Link>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y">
              {items.map((it, i) => (
                <li key={`${it.candidateId}-${it.billNumber}-${i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/candidates/${it.candidateId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {it.candidateName}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(it.date)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-1.5 align-middle font-normal">
                      {it.issueName}
                    </Badge>
                    Voted{" "}
                    <span className="font-medium text-foreground">{it.voteCast}</span> on{" "}
                    {it.url ? (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                      >
                        {it.billNumber}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-foreground">{it.billNumber}</span>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
                    {it.title}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
