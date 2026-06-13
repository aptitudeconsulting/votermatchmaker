import { Link, useParams } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetCandidate,
  useGetMyMatch,
  type CandidatePosition,
  type RecordItem,
  type MatchIssueBreakdown,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScoreRing, AlignmentBadge, PositionScale } from "@/components/civic";
import { confidenceLabel } from "@/lib/issue-meta";
import { ArrowLeft, ExternalLink, FileText, Info } from "lucide-react";

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
        <Link href="/candidates">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to candidates
          </Button>
        </Link>
      </div>
    );
  }

  const { candidate, positions, record, recordCount } = data;
  const initials = candidate.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8 md:py-12">
      <Link href="/candidates">
        <Button variant="ghost" size="sm" className="-ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> All candidates
        </Button>
      </Link>

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
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item }: { item: MatchIssueBreakdown }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{item.issueName}</span>
        <AlignmentBadge alignment={item.alignment} />
      </div>
      <PositionScale voterPosition={item.voterPosition} candidatePosition={item.candidatePosition} />
      {item.summary && <p className="text-sm text-muted-foreground">{item.summary}</p>}
    </div>
  );
}

function PositionRow({ position }: { position: CandidatePosition }) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{position.issueName}</span>
          <Badge variant="outline" className="text-xs font-normal">
            {confidenceLabel(position.confidence)}
          </Badge>
        </div>
        <PositionScale candidatePosition={position.position} />
        <p className="text-sm text-muted-foreground">{position.summary}</p>
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
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
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
