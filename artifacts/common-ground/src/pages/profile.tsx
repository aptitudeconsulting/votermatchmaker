import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetMyProfile,
  useUpdateMyLocation,
  useUpdateMyStance,
  useResetMyProfile,
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
import { importanceLabel } from "@/lib/issue-meta";
import { useInvalidateVoterData } from "@/lib/invalidate";
import { MapPin, RotateCcw } from "lucide-react";

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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="zip"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={saveLocation}
                disabled={!zipValid || updateLocation.isPending}
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
        </CardHeader>
        <CardContent>
          {stances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              You haven't built a values profile yet.
            </p>
          ) : (
            <div className="space-y-6">
              {stances.map((s) => (
                <StanceRow
                  key={s.issueId}
                  stance={s}
                  onChange={(importance) =>
                    updateStance.mutate(
                      { issueId: s.issueId, data: { importance } },
                      { onSuccess: () => void invalidate() },
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <h3 className="font-medium">Start over</h3>
          <p className="text-sm text-muted-foreground">
            Clear your answers and retake onboarding from scratch.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset your profile?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently clears your answers and issue priorities. Your location is kept.
                You'll be taken back to onboarding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={resetProfile.isPending}>
                {resetProfile.isPending ? "Resetting…" : "Reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{stance.issueName}</span>
        <span className="text-sm font-medium text-primary">{importanceLabel(value)}</span>
      </div>
      <Slider
        min={1}
        max={3}
        step={1}
        value={[value]}
        onValueChange={(v) => setValue(v[0])}
        onValueCommit={(v) => onChange(v[0])}
      />
    </div>
  );
}
