import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetMyProfile,
  useUpdateMyLocation,
  useUpdateMyStance,
  useResetMyProfile,
  useGetStanceAggregate,
  type IssueStance,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { importanceMeta, issueIconById } from "@/lib/issue-meta";
import { useInvalidateVoterData } from "@/lib/invalidate";
import { IssueCompass } from "@/components/civic";
import { MapPin, RotateCcw, Users } from "lucide-react";

export default function Profile() {
  const [, navigate] = useLocation();
  const { data: profile, isLoading } = useGetMyProfile();
  const updateLocation = useUpdateMyLocation();
  const updateStance = useUpdateMyStance();
  const resetProfile = useResetMyProfile();
  const invalidate = useInvalidateVoterData();

  const [zip, setZip] = useState("");

  useEffect(() => {
    if (profile?.location?.zip) setZip(profile.location.zip);
  }, [profile?.location?.zip]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const zipValid = /^\d{5}$/.test(zip.trim());
  const stances = profile?.stances ?? [];

  function saveLocation() {
    updateLocation.mutate(
      { data: { zip: zip.trim() } },
      { onSuccess: () => void invalidate() },
    );
  }

  function handleReset() {
    resetProfile.mutate(undefined, {
      onSuccess: async () => {
        await invalidate();
        navigate("/onboarding");
      },
    });
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8 md:py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted-foreground">
          Refine your location and how much each issue matters to you. Changes update your matches
          instantly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP code</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="zip"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                  className="pl-9 w-full"
                />
              </div>
              <Button
                onClick={saveLocation}
                disabled={!zipValid || updateLocation.isPending}
                className="w-full sm:w-auto h-10"
              >
                {updateLocation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
            {profile?.location?.stateName && (
              <p className="text-sm text-muted-foreground">
                {profile.location.stateName}
                {profile.location.district ? ` · District ${profile.location.district}` : ""}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issue priorities</CardTitle>
          <p className="text-sm text-muted-foreground">
            Drag a slider to change how much an issue counts. Issues regroup by weight after you release.
          </p>
        </CardHeader>
        <CardContent>
          {stances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              You haven't built a values profile yet.
            </p>
          ) : (
            <PriorityTiers
              stances={stances}
              onChange={(issueId, importance) =>
                updateStance.mutate(
                  { issueId, data: { importance } },
                  { onSuccess: () => void invalidate() },
                )
              }
            />
          )}
        </CardContent>
      </Card>

      {stances.length > 0 && <HowYouCompare stances={stances} />}

      <Separator />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <h3 className="font-medium">Start over</h3>
          <p className="text-sm text-muted-foreground">
            Clear your answers and retake onboarding from scratch.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto shrink-0">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[90vw] max-w-lg rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset your profile?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently clears your answers and issue priorities. Your location is kept.
                You'll be taken back to onboarding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto mt-0">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={resetProfile.isPending} className="w-full sm:w-auto">
                {resetProfile.isPending ? "Resetting…" : "Reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

const TIERS: { tier: 1 | 2 | 3; title: string }[] = [
  { tier: 3, title: "Top priorities" },
  { tier: 2, title: "Important" },
  { tier: 1, title: "Less important" },
];

function PriorityTiers({
  stances,
  onChange,
}: {
  stances: IssueStance[];
  onChange: (issueId: string, importance: number) => void;
}) {
  const sorted = [...stances].sort(
    (a, b) => b.importance - a.importance || a.issueName.localeCompare(b.issueName),
  );

  const groups = TIERS.map((t) => ({
    ...t,
    items: sorted.filter((s) => {
      if (t.tier === 3) return s.importance >= 3;
      if (t.tier === 1) return s.importance <= 1;
      return s.importance === 2;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-7">
      {groups.map((g) => {
        const meta = importanceMeta(g.tier);
        return (
          <section key={g.tier} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className={`text-xs font-semibold uppercase tracking-wide ${meta.text}`}>
                {g.title}
              </h3>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                {g.items.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {g.items.map((s) => (
                <StanceRow
                  key={s.issueId}
                  stance={s}
                  onChange={(importance) => onChange(s.issueId, importance)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Anonymized "how you compare" panel: for each issue the signed-in voter has a
 * stance on, shows their internal-axis position next to the mean position of all
 * voters (withheld until enough people have answered). Purely descriptive — never
 * framed as left/right or "normal vs not".
 */
function HowYouCompare({ stances }: { stances: IssueStance[] }) {
  const { data } = useGetStanceAggregate();
  if (!data) return null;

  const meanByIssue = new Map(data.items.map((i) => [i.issueId, i]));
  const rows = stances
    .map((s) => ({ stance: s, agg: meanByIssue.get(s.issueId) }))
    .filter(
      (r): r is { stance: IssueStance; agg: NonNullable<typeof r.agg> } =>
        r.agg != null,
    )
    .sort((a, b) => b.stance.importance - a.stance.importance);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" /> How you compare
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your stance next to the average of everyone who's answered. Anonymous and
          aggregated — issues are only shown once at least {data.minVoters} people have
          weighed in. This is a snapshot of other users, not a measure of right or wrong.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {rows.map(({ stance, agg }) => (
          <div key={stance.issueId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{stance.issueName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {agg.voterCount.toLocaleString()} voters
              </span>
            </div>
            <IssueCompass
              voterPosition={stance.position}
              candidatePosition={agg.meanPosition}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> You
          </span>
          <span className="mx-2">·</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground" /> Everyone's average
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function StanceRow({
  stance,
  onChange,
}: {
  stance: IssueStance;
  onChange: (importance: number) => void;
}) {
  const [value, setValue] = useState(stance.importance);

  useEffect(() => {
    setValue(stance.importance);
  }, [stance.importance]);

  const meta = importanceMeta(value);
  const Icon = issueIconById(stance.issueId);

  return (
    <div
      className={`rounded-lg border border-l-4 ${meta.border} ${meta.rowBg} p-3 transition-colors sm:p-4`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${meta.chip}`}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1 truncate font-medium">{stance.issueName}</span>
        <span className={`shrink-0 text-xs font-semibold ${meta.text}`}>{meta.label}</span>
      </div>
      <Slider
        min={1}
        max={3}
        step={1}
        value={[value]}
        onValueChange={(v) => setValue(v[0])}
        onValueCommit={(v) => onChange(v[0])}
        aria-label={`How much ${stance.issueName} matters to you`}
        className="mt-3"
      />
    </div>
  );
}
