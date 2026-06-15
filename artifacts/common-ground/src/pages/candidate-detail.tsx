import { useState } from "react";
import { Link, useParams } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetCandidate,
  useGetMyMatch,
  useGetCandidateIssueSummary,
  getGetCandidateIssueSummaryQueryKey,
  type CandidatePosition,
  type PositionEvidence,
  type RecordItem,
  type MatchIssueBreakdown,
  type DonorCategory,
  type Provision,
  type ProvisionFlag,
  type VoteExample,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ScoreRing,
  AlignmentBadge,
  PositionScale,
  IssueCompass,
  DonorTensionBadge,
  formatDollars,
} from "@/components/civic";
import { SaveToBallotButton } from "@/components/save-to-ballot";
import { confidenceLabel } from "@/lib/issue-meta";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Vote,
  Wallet,
} from "lucide-react";

export default function CandidateDetail() {
  const params = useParams();
  const id = params.id ?? "";
  const { data, isLoading } = useGetCandidate(id);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Candidate not found</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/candidates">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to candidates
          </Link>
        </Button>
      </div>
    );
  }

  const { candidate, positions, record, recordCount, donorCategories, hasDonorData } = data;
  const initials = candidate.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/candidates">
          <ArrowLeft className="mr-2 h-4 w-4" /> All candidates
        </Link>
      </Button>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20">
          {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} />}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{candidate.name}</h1>
            {candidate.party && <Badge variant="secondary">{candidate.party}</Badge>}
          </div>
          <p className="text-muted-foreground truncate">{candidate.currentRole}</p>
        </div>
        <Show when="signed-in">
          <div className="sm:ml-auto">
            <SaveToBallotButton candidateId={candidate.id} />
          </div>
        </Show>
      </div>

      <Show when="signed-in">
        <MatchScorecard candidateId={id} />
      </Show>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Where they stand</h2>
          <p className="text-sm text-muted-foreground">
            Positions are inferred from actual floor votes plus sponsored and
            cosponsored legislation — not campaign promises.
          </p>
        </div>
        {positions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Not enough legislative activity yet to derive issue positions.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {positions.map((p) => (
              <PositionRow key={p.issueId} position={p} candidateId={id} />
            ))}
          </div>
        )}
      </section>

      {hasDonorData && (
        <DonorSection categories={donorCategories} />
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Legislative record</h2>
          <p className="text-sm text-muted-foreground">
            {recordCount} item{recordCount === 1 ? "" : "s"} on file.
          </p>
        </div>
        {record.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No records available.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {record.map((r) => (
              <RecordRow key={r.id} item={r} />
            ))}
          </div>
        )}
        {record.some((r) => r.provisions && r.provisions.length > 0) && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="flex-1">
              Provisions are extracted by AI from each bill's official Congressional
              Research Service summary. They can contain errors — always check the
              linked source.
            </span>
          </p>
        )}
      </section>
    </div>
  );
}

function MatchScorecard({ candidateId }: { candidateId: string }) {
  const { data, isLoading, isError } = useGetMyMatch(candidateId);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          Complete your values profile to see how you match with this candidate.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={data.score} grade={data.grade} size={96} />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Your match</h2>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
            <p className="text-xs text-muted-foreground">
              Based on {Math.round(data.coverage * 100)}% issue coverage.
            </p>
          </div>
        </div>
        <Separator />
        <IssueBreakdown items={data.breakdown} />
        {data.provisionFlags && data.provisionFlags.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  What's in the bills they backed
                </h3>
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Sparkles className="h-3 w-3" /> AI-flagged
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Specific provisions inside bills this candidate sponsored that
                touch issues you answered.
              </p>
              {data.provisionFlags.map((f, i) => (
                <ProvisionFlagRow key={i} flag={f} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProvisionFlagRow({ flag }: { flag: ProvisionFlag }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        flag.conflict
          ? "border-rose-500/30 bg-rose-500/5"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-xs">
          {flag.issueName}
        </Badge>
        {flag.conflict && (
          <Badge
            variant="outline"
            className="gap-1 border-rose-500/40 text-xs text-rose-700 dark:text-rose-400"
          >
            <AlertTriangle className="h-3 w-3" /> Conflicts with your values
          </Badge>
        )}
        {flag.unrelated && (
          <Badge variant="outline" className="text-xs">
            Unrelated provision
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-foreground/90 break-words">{flag.text}</p>
      <div className="mt-1 text-xs text-muted-foreground break-words">
        From{" "}
        {flag.url ? (
          <a
            href={flag.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground break-words"
          >
            {flag.billNumber ? `${flag.billNumber} — ` : ""}
            {flag.billTitle}
          </a>
        ) : (
          <span className="break-words">
            {flag.billNumber ? `${flag.billNumber} — ` : ""}
            {flag.billTitle}
          </span>
        )}
      </div>
    </div>
  );
}

const TOP_ISSUES = 6;

/**
 * Renders the per-issue match breakdown as a compact two-column grid. Issues are
 * already returned strongest-first, so the lower-priority tail is collapsed
 * behind a toggle to keep the scorecard scannable instead of one long column.
 */
function IssueBreakdown({ items }: { items: MatchIssueBreakdown[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, TOP_ISSUES);
  const hidden = items.length - shown.length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((b) => (
          <BreakdownRow key={b.issueId} item={b} />
        ))}
      </div>
      {items.length > TOP_ISSUES && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer issues" : `Show ${hidden} more issue${hidden === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}

function VoteEvidenceLine({ voteCount }: { voteCount?: number | null }) {
  if (!voteCount || voteCount <= 0) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Vote className="h-3.5 w-3.5 shrink-0" />
      Reflects {voteCount} floor vote{voteCount === 1 ? "" : "s"}
    </p>
  );
}

function BreakdownRow({ item }: { item: MatchIssueBreakdown }) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{item.issueName}</span>
        <AlignmentBadge alignment={item.alignment} />
      </div>
      <IssueCompass voterPosition={item.voterPosition} candidatePosition={item.candidatePosition} />
      {item.summary && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <VoteEvidenceLine voteCount={item.voteCount} />
        {item.donorTension && <DonorTensionBadge />}
      </div>
      {item.donorTension && item.donorNote && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          {item.donorNote}
        </p>
      )}
    </div>
  );
}

function PositionRow({
  position,
  candidateId,
}: {
  position: CandidatePosition;
  candidateId: string;
}) {
  const insufficient = position.insufficientRecord;
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-tight">{position.issueName}</span>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {position.donorTension && <DonorTensionBadge />}
            {!insufficient && (
              <Badge variant="outline" className="text-xs font-normal">
                {confidenceLabel(position.confidence)}
              </Badge>
            )}
          </div>
        </div>
        {insufficient ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Insufficient record to assess
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Not enough clear legislative evidence to place a position. We show
              the bills below rather than guess.
            </p>
          </div>
        ) : (
          <>
            <PositionScale candidatePosition={position.position} />
            <p className="text-sm text-muted-foreground">{position.summary}</p>
          </>
        )}
        {position.donorTension && position.donorNote && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {position.donorNote}
          </p>
        )}
        {position.voteExamples && position.voteExamples.length > 0 && (
          <VoteExamples examples={position.voteExamples} />
        )}
        {position.evidence && position.evidence.length > 0 && (
          <PositionReceipts evidence={position.evidence} />
        )}
        {position.sourceCount > 0 && (
          <RecordSummary candidateId={candidateId} issueId={position.issueId} />
        )}
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          {[
            position.voteCount > 0
              ? `${position.voteCount} floor vote${position.voteCount === 1 ? "" : "s"}`
              : null,
            position.sourceCount > 0
              ? `${position.sourceCount} bill${position.sourceCount === 1 ? "" : "s"} on file`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * "Receipts" — the specific bills behind a derived (or insufficient) position,
 * each with the one-sentence rationale from its neutral CRS summary and a link
 * to the source. This is how the score stays auditable.
 */
function PositionReceipts({ evidence }: { evidence: PositionEvidence[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? evidence : evidence.slice(0, 2);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        Why — contributing bills
      </p>
      {shown.map((ev) => (
        <div
          key={ev.recordId}
          className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs capitalize">
              {ev.kind}
            </Badge>
            {ev.url ? (
              <a
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium underline hover:text-foreground break-all"
              >
                {ev.billNumber ?? ev.title}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="font-medium break-all">{ev.billNumber ?? ev.title}</span>
            )}
          </div>
          {ev.rationale && (
            <p className="mt-1 text-foreground/80 break-words">{ev.rationale}</p>
          )}
        </div>
      ))}
      {evidence.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-muted-foreground underline hover:text-foreground p-1"
        >
          {expanded
            ? "Show fewer"
            : `Show ${evidence.length - 2} more bill${evidence.length - 2 === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

/**
 * Lazily fetches an AI-generated plain-language summary of the candidate's bills
 * on this issue (only on click, so we don't generate for every card). The summary
 * is cached server-side, and we always keep the auditable receipts above it.
 */
function RecordSummary({
  candidateId,
  issueId,
}: {
  candidateId: string;
  issueId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useGetCandidateIssueSummary(
    candidateId,
    issueId,
    {
      query: {
        enabled: open,
        staleTime: Infinity,
        queryKey: getGetCandidateIssueSummaryQueryKey(candidateId, issueId),
      },
    },
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-md p-1 text-xs font-medium text-muted-foreground underline hover:text-foreground"
      >
        <Sparkles className="h-3 w-3 shrink-0" /> Summarize their record (AI)
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3 shrink-0" /> AI summary of their record
      </p>
      {isLoading ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> Summarizing…
        </p>
      ) : isError ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Couldn't generate a summary right now. Please try again later.
        </p>
      ) : data?.summary ? (
        <>
          <p className="mt-1 break-words text-xs text-foreground/80">
            {data.summary}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            AI-generated from these bills' official CRS summaries — it can contain
            errors. Check the linked bills above.
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Not enough bill detail to generate a summary.
        </p>
      )}
    </div>
  );
}

/** A short list of illustrative roll-call votes behind a vote-derived position. */
function VoteExamples({ examples }: { examples: VoteExample[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? examples : examples.slice(0, 2);
  return (
    <div className="space-y-1.5">
      {shown.map((ex, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs"
        >
          <Vote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span
              className={`mr-1.5 font-medium ${
                ex.aligns
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {ex.voteCast}
            </span>
            {ex.url ? (
              <a
                href={ex.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground break-all"
              >
                {ex.billNumber}
              </a>
            ) : (
              <span className="break-all">{ex.billNumber}</span>
            )}
            <span className="text-muted-foreground"> — {ex.title}</span>
          </div>
        </div>
      ))}
      {examples.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-muted-foreground underline hover:text-foreground p-1"
        >
          {expanded ? "Show fewer votes" : `Show ${examples.length - 2} more vote${examples.length - 2 === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

function DonorSection({ categories }: { categories: DonorCategory[] }) {
  const total = categories.reduce((s, c) => s + c.total, 0);
  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          Who funds them
        </h2>
        <p className="text-sm text-muted-foreground">
          Donor categories are derived from FEC campaign-finance filings by matching
          contributor and employer names — an independent signal from their voting record.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3 py-5">
          {categories.map((c) => {
            const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
            return (
              <div key={c.sector} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium break-words">{c.label}</span>
                  <span className="text-muted-foreground flex items-center gap-1.5 flex-wrap justify-end">
                    {formatDollars(c.total)}
                    <span className="text-xs">· informs {c.issueName}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/70"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-muted-foreground">
            Source: FEC (api.open.fec.gov). Categories are inferred from contributor
            and employer names, not official FEC industry codes, so they are
            approximate. Donor money never changes a candidate's position — it only
            adjusts our confidence and flags tensions.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function RecordRow({ item }: { item: RecordItem }) {
  const content = (
    <Card className="transition hover-elevate h-full">
      <CardContent className="flex flex-col sm:flex-row items-start gap-3 py-4">
        <div className="flex w-full sm:w-auto items-start gap-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium leading-snug break-words">{item.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs capitalize">
                {item.kind}
              </Badge>
              {item.billNumber && <span className="break-all">{item.billNumber}</span>}
              {item.issueName && <span>· {item.issueName}</span>}
              {item.date && <span>· {item.date}</span>}
            </div>
            {item.summary && (
              <p className="line-clamp-3 text-sm text-muted-foreground break-words">{item.summary}</p>
            )}
            {item.provisions && item.provisions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {item.provisions.map((p, i) => (
                  <ProvisionLine key={i} provision={p} />
                ))}
              </div>
            )}
          </div>
        </div>
        {item.url && <ExternalLink className="hidden sm:block mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  );

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}

function ProvisionLine({ provision }: { provision: Provision }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
        {provision.issueName && (
          <Badge variant="secondary" className="text-xs">
            {provision.issueName}
          </Badge>
        )}
        {provision.unrelated && (
          <Badge variant="outline" className="text-xs">
            Unrelated provision
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-foreground/80 break-words">{provision.text}</p>
    </div>
  );
}
