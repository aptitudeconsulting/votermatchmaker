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
import { ScoreRing, DonorTensionBadge } from "@/components/civic";
import { MapPin, Star, ArrowRight, ThumbsUp, ThumbsDown } from "lucide-react";

const LEVELS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "senate", label: "Senate" },
  { value: "house", label: "House" },
  { value: "local", label: "Local" },
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
          <Tabs value={level} onValueChange={setLevel} className="mt-6">
            <TabsList>
              {LEVELS.map((l) => (
                <TabsTrigger key={l.value} value={l.value}>
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
  } = match;

  return (
    <Link href={`/candidates/${candidate.id}`}>
      <Card className="transition hover-elevate">
        <CardContent className="flex flex-col gap-5 py-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-4">
            <ScoreRing score={score} grade={grade} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{candidate.name}</h3>
              {candidate.party && <Badge variant="secondary">{candidate.party}</Badge>}
              {candidate.isSample && (
                <Badge variant="outline" className="text-xs">
                  Sample race
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{candidate.currentRole}</p>
            <p className="text-sm">{summary}</p>

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
          </div>

          <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
        </CardContent>
      </Card>
    </Link>
  );
}
