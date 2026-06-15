import { useMemo, useState } from "react";
import { Link, useSearchParams } from "wouter";
import {
  useGetMyMatch,
  getGetMyMatchQueryKey,
  useListCandidates,
  getListCandidatesQueryKey,
  useGetMyProfile,
  type MatchDetail,
  type MatchIssueBreakdown,
  type Candidate,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRing, PositionScale } from "@/components/civic";
import { issueIconById, alignmentMeta, importanceLabel } from "@/lib/issue-meta";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/use-debounce";
import { Plus, X, Search, Scale, Star, ArrowRight } from "lucide-react";

const MAX = 3;

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ids = parseIds(searchParams.get("ids"));
  const { data: profile } = useGetMyProfile();
  const needsOnboarding = profile && profile.stances.length === 0;

  const setIds = (next: string[]) => {
    const p = new URLSearchParams();
    if (next.length) p.set("ids", next.slice(0, MAX).join(","));
    setSearchParams(p, { replace: true });
  };

  const addId = (id: string) => {
    if (ids.includes(id) || ids.length >= MAX) return;
    setIds([...ids, id]);
  };
  const removeId = (id: string) => setIds(ids.filter((x) => x !== id));

  // Fixed-count hooks so we never call hooks in a loop.
  const m0 = useGetMyMatch(ids[0] ?? "", {
    query: { enabled: !!ids[0], queryKey: getGetMyMatchQueryKey(ids[0] ?? "") },
  });
  const m1 = useGetMyMatch(ids[1] ?? "", {
    query: { enabled: !!ids[1], queryKey: getGetMyMatchQueryKey(ids[1] ?? "") },
  });
  const m2 = useGetMyMatch(ids[2] ?? "", {
    query: { enabled: !!ids[2], queryKey: getGetMyMatchQueryKey(ids[2] ?? "") },
  });
  const slots = [m0, m1, m2];

  const columns = ids.map((id, i) => ({ id, query: slots[i] }));

  // Union of issues across all loaded candidates, ordered by the voter's importance.
  const issueRows = useMemo(() => {
    const map = new Map<string, { issueId: string; issueName: string; importance: number }>();
    for (const c of columns) {
      const detail = c.query.data as MatchDetail | undefined;
      detail?.breakdown.forEach((b) => {
        const existing = map.get(b.issueId);
        if (!existing || b.voterImportance > existing.importance) {
          map.set(b.issueId, {
            issueId: b.issueId,
            issueName: b.issueName,
            importance: b.voterImportance,
          });
        }
      });
    }
    return [...map.values()].sort(
      (a, b) => b.importance - a.importance || a.issueName.localeCompare(b.issueName),
    );
  }, [columns.map((c) => c.id).join(","), m0.data, m1.data, m2.data]);

  const byIssue = (detail: MatchDetail | undefined, issueId: string) =>
    detail?.breakdown.find((b) => b.issueId === issueId);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="flex items-center gap-2 text-primary">
        <Scale className="h-5 w-5" />
        <span className="text-sm font-medium uppercase tracking-wide">Compare</span>
      </div>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Compare candidates side by side</h1>
      <p className="mt-1 text-muted-foreground">
        Pick up to {MAX} candidates to see how each one's legislative record aligns with your values,
        issue by issue.
      </p>

      {needsOnboarding ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Star className="h-10 w-10 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Build your values profile first</h2>
              <p className="mt-1 text-muted-foreground">
                Comparing needs your priorities. Answer a few questions to get started.
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
          <CandidatePicker
            selectedIds={ids}
            disabled={ids.length >= MAX}
            onAdd={addId}
          />

          {ids.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-12 text-center text-muted-foreground">
                Add candidates above to start comparing. Tip: open a candidate from{" "}
                <Link href="/matches" className="text-primary underline-offset-2 hover:underline">
                  your matches
                </Link>{" "}
                and use “Add to compare”.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${ids.length}, minmax(180px,1fr))` }}
              >
                {/* Header row */}
                <div className="hidden sm:block" />
                {columns.map((c) => (
                  <ColumnHeader
                    key={c.id}
                    query={c.query}
                    onRemove={() => removeId(c.id)}
                  />
                ))}

                {/* Issue rows */}
                {issueRows.length > 0 && (
                  <div className="col-span-full mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agreement by issue
                  </div>
                )}
                {issueRows.map((row) => {
                  const Icon = issueIconById(row.issueId);
                  return (
                    <div key={row.issueId} className="contents">
                      <div className="flex items-center gap-2 border-t py-3 pr-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{row.issueName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {importanceLabel(row.importance)}
                          </div>
                        </div>
                      </div>
                      {columns.map((c) => {
                        const b = byIssue(c.query.data as MatchDetail | undefined, row.issueId);
                        return (
                          <IssueCell
                            key={c.id + row.issueId}
                            breakdown={b}
                            loading={c.query.isLoading}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ColumnHeader({
  query,
  onRemove,
}: {
  query: ReturnType<typeof useGetMyMatch>;
  onRemove: () => void;
}) {
  const detail = query.data as MatchDetail | undefined;
  return (
    <Card className="relative">
      <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Remove from comparison"
        >
          <X className="h-4 w-4" />
        </button>
        {query.isLoading || !detail ? (
          <>
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <ScoreRing score={detail.score} grade={detail.grade} size={72} />
            <Link
              href={`/candidates/${detail.candidate.id}`}
              className="text-sm font-semibold leading-tight hover:underline"
            >
              {detail.candidate.name}
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {detail.candidate.party && (
                <Badge variant="secondary" className="text-[10px]">
                  {detail.candidate.party}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{detail.candidate.currentRole}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function IssueCell({
  breakdown,
  loading,
}: {
  breakdown: MatchIssueBreakdown | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="border-t py-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-2 h-2 w-full" />
      </div>
    );
  }
  if (!breakdown) {
    return (
      <div className="flex items-center border-t py-3 text-xs text-muted-foreground">
        No record
      </div>
    );
  }
  const meta = alignmentMeta(breakdown.alignment);
  return (
    <div className="border-t py-3">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          meta.className,
        )}
      >
        {meta.label}
      </span>
      <div className="mt-2 pr-2">
        <PositionScale
          voterPosition={breakdown.voterPosition}
          candidatePosition={breakdown.candidatePosition}
        />
      </div>
    </div>
  );
}

function CandidatePicker({
  selectedIds,
  disabled,
  onAdd,
}: {
  selectedIds: string[];
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 300);
  const params = debounced.trim() ? { q: debounced.trim(), limit: 8 } : undefined;
  const { data, isLoading } = useListCandidates(params, {
    query: {
      enabled: debounced.trim().length > 0,
      queryKey: getListCandidatesQueryKey(params),
    },
  });
  const results = (data?.items ?? []).filter((c: Candidate) => !selectedIds.includes(c.id));

  return (
    <div className="mt-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={disabled ? `Remove one to add more (max ${MAX})` : "Search candidates to add…"}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      {debounced.trim() && !disabled && (
        <Card className="mt-2">
          <CardContent className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No candidates found.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {results.map((c: Candidate) => (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        onAdd(c.id);
                        setQ("");
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.currentRole}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
