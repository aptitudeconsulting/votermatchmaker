import { useState } from "react";
import { Link } from "wouter";
import {
  useListMyMatches,
  useGetMyProfile,
  type MatchResult,
  type ListMyMatchesLevel,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScoreRing,
  DonorTensionBadge,
  ReelectionBadge,
  formatDollars,
} from "@/components/civic";
import { MapPin, Star, ArrowRight, ThumbsUp, ThumbsDown, Wallet } from "lucide-react";

const LEVELS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "senate", label: "Senate" },
  { value: "house", label: "House" },
];

export default function Matches() {
  const [level, setLevel] = useState<string>("all");
  const { data: profile } = useGetMyProfile();
  const { data: matches, isLoading } = useListMyMatches(
    level === "all" ? undefined : { level: level as ListMyMatchesLevel },
  );

  const needsOnboarding = profile && profile.stances.length === 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your matches</h1>
          <p className="mt-1 text-muted-foreground">
            Candidates ranked by how well their legislative record aligns with your values.
          </p>
        </div>
        {profile?.location?.stateName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {profile.location.stateName}
            {profile.location.district ? ` · District ${profile.location.district}` : ""}
          </div>
        )}
      </div>

      {needsOnboarding ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Star className="h-10 w-10 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Build your values profile first</h2>
              <p className="mt-1 text-muted-foreground">
                Answer a few questions and we'll match you to candidates.
              </p>
            </div>
            <Button asChild>
              <Link href="/onboarding">
                Start onboarding <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={level} onValueChange={setLevel} className="mt-6 w-full sm:w-auto overflow-x-auto">
            <TabsList className="w-full justify-start sm:w-auto overflow-x-auto h-12 flex-nowrap shrink-0">
              {LEVELS.map((l) => (
                <TabsTrigger key={l.value} value={l.value} className="whitespace-nowrap min-w-16">
                  {l.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))
            ) : matches && matches.length > 0 ? (
              matches.map((m) => <MatchCard key={m.candidate.id} match={m} />)
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No candidates found for this filter yet.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  const {
    candidate,
    score,
    grade,
    summary,
    topAgreements,
    topDisagreements,
    sharedPriorityCount,
    donorTensionCount,
    donorCategories,
    donorTensions,
    hasDonorData,
  } = match;

  return (
    <Link href={`/candidates/${candidate.id}`}>
      <Card className="transition hover-elevate">
        <CardContent className="flex flex-col gap-5 py-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center justify-center gap-4">
            <ScoreRing score={score} grade={grade} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{candidate.name}</h3>
              {candidate.party && <Badge variant="secondary">{candidate.party}</Badge>}
              {candidate.upForReelection && (
                <ReelectionBadge electionYear={candidate.electionYear} />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{candidate.currentRole}</p>
            <p className="text-sm break-words">{summary}</p>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              {topAgreements[0] && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {topAgreements[0].issueName}
                </span>
              )}
              {topDisagreements[0] && (
                <span className="flex items-center gap-1.5 text-sm text-rose-700">
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {topDisagreements[0].issueName}
                </span>
              )}
              {sharedPriorityCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5" />
                  {sharedPriorityCount} shared{" "}
                  {sharedPriorityCount === 1 ? "priority" : "priorities"}
                </span>
              )}
              {donorTensionCount > 0 && <DonorTensionBadge count={donorTensionCount} />}
            </div>

            {hasDonorData && (
              <DonorSummary
                categories={donorCategories}
                tensions={donorTensions}
              />
            )}
          </div>

          <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Compact "Who funds them" treatment for the ranked results, mirroring the
 * candidate-detail donor section: top funding sectors with dollar amounts and
 * "informs X" labels, per-issue donor tensions, and FEC attribution. Rendered
 * only when classified FEC data exists, so it degrades silently otherwise.
 */
function DonorSummary({
  categories,
  tensions,
}: {
  categories: MatchResult["donorCategories"];
  tensions: string[];
}) {
  if (categories.length === 0 && tensions.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3 overflow-hidden">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Wallet className="h-3.5 w-3.5 shrink-0" />
        Who funds them
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.sector}
              className="inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs"
            >
              <span className="font-medium break-all">{c.label}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {formatDollars(c.total)} · informs {c.issueName}
              </span>
            </span>
          ))}
        </div>
      )}
      {tensions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <DonorTensionBadge count={tensions.length} className="shrink-0" />
          <span className="text-muted-foreground break-words">on {joinNames(tensions)}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Source: FEC. Sectors are inferred from contributor and employer names, not
        official codes. Donor money never changes a position — it only adjusts
        confidence and flags tensions.
      </p>
    </div>
  );
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
