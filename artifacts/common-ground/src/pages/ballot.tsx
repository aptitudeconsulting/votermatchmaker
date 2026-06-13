import { useGetMyBallot, type BallotResource } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  ExternalLink,
  ScrollText,
  Landmark,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Vote,
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
      className="group block"
    >
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardContent className="flex h-full flex-col gap-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge variant="secondary" className="font-normal">
              {CATEGORY_LABEL[resource.category] ?? "Resource"}
            </Badge>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <h3 className="font-semibold leading-snug">{resource.name}</h3>
          <p className="text-sm text-muted-foreground">{resource.description}</p>
        </CardContent>
      </Card>
    </a>
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
            <MapPin className="h-4 w-4" />
            {ballot.location.stateName}
            {ballot.location.zip ? ` · ${ballot.location.zip}` : ""}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Strictly non-partisan.</span>{" "}
          Every source here is an official government body or a recognized
          non-partisan organization. Where measures are shown, we present both the
          arguments for and against — we never tell you how to vote.
        </p>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
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
                  <Button>Go to profile</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {ballot?.liveData?.available && (
            <section className="mt-10">
              <div className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-primary" />
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
                <p className="mt-4 text-muted-foreground">
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
                          <span>
                            {m.title}
                            {m.subtitle && (
                              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                                {m.subtitle}
                              </span>
                            )}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {m.summary && (
                          <p className="text-sm text-muted-foreground">{m.summary}</p>
                        )}
                        {(m.proStatement || m.conStatement) && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {m.proStatement && (
                              <div className="rounded-lg border border-green-600/20 bg-green-600/5 p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-green-700">
                                  <ThumbsUp className="h-4 w-4" /> Argument for
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {m.proStatement}
                                </p>
                              </div>
                            )}
                            {m.conStatement && (
                              <div className="rounded-lg border border-red-600/20 bg-red-600/5 p-3">
                                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
                                  <ThumbsDown className="h-4 w-4" /> Argument against
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {m.conStatement}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {m.passageThreshold && (
                            <span className="text-muted-foreground">
                              Passage threshold: {m.passageThreshold}
                            </span>
                          )}
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              Official text <ExternalLink className="h-3.5 w-3.5" />
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
            <p className="mt-8 text-sm text-muted-foreground">
              No live ballot measures are available for your area right now. Use the
              official and non-partisan resources below to look up your full sample
              ballot.
            </p>
          )}

          <section className="mt-10">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Non-partisan resources</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Look up your full sample ballot, research measures, check your
              registration, and find your polling place.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
