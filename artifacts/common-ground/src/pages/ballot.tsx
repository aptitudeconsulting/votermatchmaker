import {
  useGetMyBallot,
  useListMyBallotPicks,
  useRemoveMyBallotPick,
  type BallotResource,
  type BallotPick,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateVoterData } from "@/lib/invalidate";
import {
  MapPin,
  ExternalLink,
  ScrollText,
  Landmark,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Vote,
  ListChecks,
  Printer,
  X,
  ArrowRight,
  CalendarClock,
  UserCheck,
  Navigation,
  PenLine,
} from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  "ballot-measures": "Ballot measures",
  "sample-ballot": "Sample ballot",
  registration: "Registration",
  polling: "Polling place",
  research: "Research",
};

function ResourceCard({ resource }: { resource: BallotResource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full"
    >
      <Card className="h-full transition-colors hover:border-primary/50 flex flex-col">
        <CardContent className="flex flex-col gap-2 p-5 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Badge variant="secondary" className="font-normal shrink-0">
              {CATEGORY_LABEL[resource.category] ?? "Resource"}
            </Badge>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary mt-0.5" />
          </div>
          <h3 className="font-semibold leading-snug break-words">{resource.name}</h3>
          <p className="text-sm text-muted-foreground break-words">{resource.description}</p>
        </CardContent>
      </Card>
    </a>
  );
}

interface CivicAction {
  label: string;
  description: string;
  href: string;
  icon: typeof PenLine;
}

/**
 * Prominent "make a plan to vote" action band. These are the high-intent civic
 * tasks (register, check registration, find your polling place, deadlines) pulled
 * out of the long resource grid into one always-available band. Every link is an
 * official government or recognized non-partisan tool, all address/state-aware, so
 * the band degrades gracefully even with no live Google Civic election data — it is
 * never gated on a known location or an active election.
 */
function CivicActionBand({
  electionDay,
}: {
  electionDay?: string | null;
}) {
  const actions: CivicAction[] = [
    {
      label: "Register to vote",
      description: "Register or update your registration on the official U.S. government site.",
      href: "https://vote.gov/",
      icon: PenLine,
    },
    {
      label: "Check your registration",
      description: "Confirm you're registered and see your state's deadlines (NASS).",
      href: "https://www.nass.org/can-I-vote/voter-registration-status",
      icon: UserCheck,
    },
    {
      label: "Find your polling place",
      description: "Look up where and when to vote in person for your address (NASS).",
      href: "https://www.nass.org/can-I-vote/find-your-polling-place",
      icon: Navigation,
    },
  ];

  return (
    <section className="mt-8 rounded-xl border bg-card p-5 print-hidden">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
          <h2 className="text-lg font-semibold">Make a plan to vote</h2>
        </div>
        {electionDay && (
          <Badge variant="secondary" className="self-start font-normal sm:self-auto">
            Next election day: {electionDay}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Three quick, official steps — wherever you live. Deadlines and rules vary
        by state, so check early.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <a
              key={a.href}
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 rounded-lg border bg-background p-4 transition-colors hover:border-primary/50"
            >
              <span className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              </span>
              <span className="font-medium leading-snug">{a.label}</span>
              <span className="text-xs text-muted-foreground">{a.description}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function SavedPickRow({ pick }: { pick: BallotPick }) {
  const invalidate = useInvalidateVoterData();
  const remove = useRemoveMyBallotPick();
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <ListChecks className="h-4 w-4 shrink-0 text-primary" />
      <Link href={`/candidates/${pick.candidate.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium hover:underline">
          {pick.candidate.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {pick.candidate.currentRole}
          {pick.candidate.party ? ` · ${pick.candidate.party}` : ""}
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="print-hidden h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={`Remove ${pick.candidate.name} from your ballot`}
        disabled={remove.isPending}
        onClick={() =>
          remove.mutate(
            { candidateId: pick.candidate.id },
            { onSuccess: () => void invalidate() },
          )
        }
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SavedPicksSection() {
  const { data: picks, isLoading } = useListMyBallotPicks();
  const items = picks ?? [];

  return (
    <section className="mt-10" data-ballot-print>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 shrink-0 text-primary" />
          <h2 className="text-xl font-semibold">My ballot</h2>
        </div>
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="print-hidden gap-2 self-start sm:self-auto"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print checklist
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground print-hidden">
        Candidates you've saved while browsing. Print this as a checklist to take with you.
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-4 print-hidden">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ListChecks className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-medium">No saved candidates yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap "Save to ballot" on any candidate to build your personal list.
              </p>
            </div>
            <Link href="/matches">
              <Button className="mt-1 gap-2">
                See your matches <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((p) => (
            <SavedPickRow key={p.candidate.id} pick={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Ballot() {
  const { data: ballot, isLoading } = useGetMyBallot();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your ballot</h1>
          <p className="mt-1 text-muted-foreground">
            Neutral, official, and non-partisan resources for what's on your ballot.
          </p>
        </div>
        {ballot?.location?.stateName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {ballot.location.stateName}
              {ballot.location.zip ? ` · ${ballot.location.zip}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 print-hidden">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Strictly non-partisan.</span>{" "}
          Every source here is an official government body or a recognized
          non-partisan organization. Where measures are shown, we present both the
          arguments for and against — we never tell you how to vote.
        </p>
      </div>

      <CivicActionBand electionDay={ballot?.liveData?.electionDay} />

      <Show when="signed-in">
        <SavedPicksSection />
      </Show>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {!ballot?.hasLocation && (
            <Card className="mt-8">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <MapPin className="h-10 w-10 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Add your location</h2>
                  <p className="mt-1 text-muted-foreground">
                    Add your ZIP code in your profile to tailor these resources to
                    your state.
                  </p>
                </div>
                <Link href="/profile">
                  <Button className="w-full sm:w-auto mt-2">Go to profile</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {ballot?.liveData?.available && (
            <section className="mt-10">
              <div className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-xl font-semibold">
                  {ballot.liveData.electionName ?? "Measures on your ballot"}
                </h2>
              </div>
              {ballot.liveData.electionDay && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Election day: {ballot.liveData.electionDay}
                </p>
              )}

              {ballot.measures.length === 0 ? (
                <p className="mt-4 text-muted-foreground text-sm">
                  No statewide ballot measures are currently listed for your
                  address. Use the resources below to view your full sample ballot.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {ballot.measures.map((m) => (
                    <Card key={m.id}>
                      <CardHeader>
                        <CardTitle className="flex items-start gap-2 text-lg">
                          <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block break-words">{m.title}</span>
                            {m.subtitle && (
                              <span className="mt-1 block text-sm font-normal text-muted-foreground break-words">
                                {m.subtitle}
                              </span>
                            )}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {m.summary && (
                          <p className="text-sm text-muted-foreground break-words">{m.summary}</p>
                        )}
                        {(m.proStatement || m.conStatement) && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {m.proStatement && (
                              <div className="rounded-lg border border-green-600/20 bg-green-600/5 p-3 flex flex-col h-full">
                                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-green-700">
                                  <ThumbsUp className="h-4 w-4 shrink-0" /> Argument for
                                </div>
                                <p className="text-sm text-muted-foreground break-words flex-1">
                                  {m.proStatement}
                                </p>
                              </div>
                            )}
                            {m.conStatement && (
                              <div className="rounded-lg border border-red-600/20 bg-red-600/5 p-3 flex flex-col h-full">
                                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
                                  <ThumbsDown className="h-4 w-4 shrink-0" /> Argument against
                                </div>
                                <p className="text-sm text-muted-foreground break-words flex-1">
                                  {m.conStatement}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm pt-2">
                          {m.passageThreshold && (
                            <span className="text-muted-foreground break-words">
                              Passage threshold: {m.passageThreshold}
                            </span>
                          )}
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline break-all"
                            >
                              Official text <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {ballot?.hasLocation && !ballot?.liveData?.available && (
            <p className="mt-8 text-sm text-muted-foreground border p-4 rounded-lg bg-muted/20">
              No live ballot measures are available for your area right now. Use the
              official and non-partisan resources below to look up your full sample
              ballot.
            </p>
          )}

          <section className="mt-10">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-xl font-semibold">Non-partisan resources</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Look up your full sample ballot, research measures, check your
              registration, and find your polling place.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {ballot?.resources?.map((r) => (
                <ResourceCard key={r.url} resource={r} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
