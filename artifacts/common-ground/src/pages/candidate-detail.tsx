import { Link, useParams } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetCandidate,
  useGetMyMatch,
  type CandidatePosition,
  type RecordItem,
  type MatchIssueBreakdown,
  type DonorCategory,
  type Provision,
  type ProvisionFlag,
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
  DonorTensionBadge,
  formatDollars,
} from "@/components/civic";
import { confidenceLabel } from "@/lib/issue-meta";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Info,
  Sparkles,
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
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{candidate.name}</h1>
            {candidate.party && <Badge variant="secondary">{candidate.party}</Badge>}
          </div>
          <p className="text-muted-foreground">{candidate.currentRole}</p>
          {candidate.isSample && (
            <Badge variant="outline" className="text-xs">
              Sample local race
            </Badge>
          )}
        </div>
      </div>

      <Show when="signed-in">
        <MatchScorecard candidateId={id} />
      </Show>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Where they stand</h2>
          <p className="text-sm text-muted-foreground">
            Positions are inferred from sponsored and cosponsored legislation — not campaign
            promises.
          </p>
        </div>
        {positions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Not enough legislative activity yet to derive issue positions.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {positions.map((p) => (
              <PositionRow key={p.issueId} position={p} />
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
            Provisions are extracted by AI from each bill's official Congressional
            Research Service summary. They can contain errors — always check the
            linked source.
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
        <div className="space-y-4">
          {data.breakdown.map((b) => (
            <BreakdownRow key={b.issueId} item={b} />
          ))}
        </div>
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
      <p className="mt-1.5 text-foreground/90">{flag.text}</p>
      <div className="mt-1 text-xs text-muted-foreground">
        From{" "}
        {flag.url ? (
          <a
            href={flag.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {flag.billNumber ? `${flag.billNumber} — ` : ""}
            {flag.billTitle}
          </a>
        ) : (
          <span>
            {flag.billNumber ? `${flag.billNumber} — ` : ""}
            {flag.billTitle}
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ item }: { item: MatchIssueBreakdown }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{item.issueName}</span>
        <div className="flex items-center gap-1.5">
          {item.donorTension && <DonorTensionBadge />}
          <AlignmentBadge alignment={item.alignment} />
        </div>
      </div>
      <PositionScale voterPosition={item.voterPosition} candidatePosition={item.candidatePosition} />
      {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
      {item.donorTension && item.donorNote && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {item.donorNote}
        </p>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: CandidatePosition }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{position.issueName}</span>
          <div className="flex items-center gap-1.5">
            {position.donorTension && <DonorTensionBadge />}
            <Badge variant="outline" className="text-xs font-normal">
              {confidenceLabel(position.confidence)}
            </Badge>
          </div>
        </div>
        <PositionScale candidatePosition={position.position} />
        <p className="text-sm text-muted-foreground">{position.summary}</p>
        {position.donorTension && position.donorNote && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {position.donorNote}
          </p>
        )}
        {position.sourceCount > 0 && (
          <p className="text-xs text-muted-foreground">
            From {position.sourceCount} legislative item
            {position.sourceCount === 1 ? "" : "s"}.
          </p>
        )}
      </CardContent>
    </Card>
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
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground">
                    {formatDollars(c.total)}
                    <span className="ml-1.5 text-xs">· informs {c.issueName}</span>
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
    <Card className="transition hover-elevate">
      <CardContent className="flex items-start gap-3 py-4">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug">{item.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs capitalize">
              {item.kind}
            </Badge>
            {item.billNumber && <span>{item.billNumber}</span>}
            {item.issueName && <span>· {item.issueName}</span>}
            {item.date && <span>· {item.date}</span>}
          </div>
          {item.summary && (
            <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
          )}
          {item.provisions && item.provisions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {item.provisions.map((p, i) => (
                <ProvisionLine key={i} provision={p} />
              ))}
            </div>
          )}
        </div>
        {item.url && <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  );

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
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
        <Sparkles className="h-3 w-3 text-muted-foreground" />
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
      <p className="mt-1 text-xs text-foreground/80">{provision.text}</p>
    </div>
  );
}
