import { useState } from "react";
import type { MatchResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { GradeBadge } from "@/components/civic";
import { Share2, Check, Copy } from "lucide-react";

const SITE_URL = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;

function buildShareText(top: MatchResult[]): string {
  const lines = top.map(
    (m, i) => `${i + 1}. ${m.candidate.name} — ${Math.round(m.score)}% match (${m.grade})`,
  );
  return [
    "My top Voter Compass matches:",
    ...lines,
    "",
    `Find candidates who vote your values: ${SITE_URL}`,
  ].join("\n");
}

/**
 * A screenshot-friendly summary of the voter's top matches plus native share /
 * copy-link actions. No personal data leaves the device unless the user shares.
 */
export function ShareResults({ matches }: { matches: MatchResult[] }) {
  const [copied, setCopied] = useState(false);
  const top = matches.slice(0, 3);
  if (top.length === 0) return null;

  const shareText = buildShareText(top);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Voter Compass matches", text: shareText, url: SITE_URL });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    handleCopy();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <Share2 className="h-3.5 w-3.5" />
            Share your results
          </div>
          <ol className="mt-3 space-y-2">
            {top.map((m, i) => (
              <li key={m.candidate.id} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <GradeBadge grade={m.grade} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.candidate.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {Math.round(m.score)}% match · {m.candidate.currentRole}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
