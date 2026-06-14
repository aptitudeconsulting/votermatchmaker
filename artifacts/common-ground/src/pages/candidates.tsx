import { useEffect, useState } from "react";
import { Link, useSearchParams } from "wouter";
import {
  useListCandidates,
  type Candidate,
  type ListCandidatesLevel,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ArrowRight } from "lucide-react";

const LEVELS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "senate", label: "Senate" },
  { value: "house", label: "House" },
];

const PAGE_SIZE = 60;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Candidates() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialLevel = searchParams.get("level") ?? "all";
  const initialQ = searchParams.get("q") ?? "";

  const [level, setLevel] = useState<string>(
    LEVELS.some((l) => l.value === initialLevel) ? initialLevel : "all",
  );
  const [q, setQ] = useState(initialQ);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const debouncedQ = useDebounced(q.trim(), 300);

  // Keep filter/search state in the URL so it survives refresh and is shareable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (level !== "all") next.set("level", level);
    if (debouncedQ) next.set("q", debouncedQ);
    setSearchParams(next, { replace: true });
  }, [level, debouncedQ, setSearchParams]);

  // Reset paging whenever the filter or search changes.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [level, debouncedQ]);

  const { data, isLoading } = useListCandidates({
    ...(level === "all" ? {} : { level: level as ListCandidatesLevel }),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    limit,
  });

  const candidates = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = candidates.length < total;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse candidates</h1>
        <p className="mt-1 text-muted-foreground">
          Every position below is derived from real legislative records on Congress.gov.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={level} onValueChange={setLevel} className="w-full sm:w-auto overflow-x-auto">
          <TabsList className="w-full justify-start sm:w-auto overflow-x-auto h-12 flex-nowrap shrink-0">
            {LEVELS.map((l) => (
              <TabsTrigger key={l.value} value={l.value} className="whitespace-nowrap min-w-16">
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search candidates by name or state"
            placeholder="Search by name or state"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
      </div>

      {!isLoading && total > 0 && (
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          Showing {candidates.length} of {total.toLocaleString()}{" "}
          {total === 1 ? "candidate" : "candidates"}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : candidates.length > 0 ? (
          candidates.map((c) => <CandidateCard key={c.id} candidate={c} />)
        ) : (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">
              No candidates match your search.
            </CardContent>
          </Card>
        )}
      </div>

      {!isLoading && hasMore && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const initials = candidate.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <Link href={`/candidates/${candidate.id}`}>
      <Card className="h-full transition hover-elevate flex flex-col justify-center">
        <CardContent className="flex items-center gap-4 py-4">
          <Avatar className="h-12 w-12 shrink-0">
            {candidate.photoUrl && <AvatarImage src={candidate.photoUrl} alt={candidate.name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold max-w-full">{candidate.name}</h3>
              {candidate.party && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {candidate.party}
                </Badge>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">{candidate.currentRole}</p>
          </div>
          <ArrowRight className="hidden sm:block h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
