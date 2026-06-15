import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useInvalidateVoterData } from "@/lib/invalidate";
import {
  useListQuestions,
  useGetMyProfile,
  useUpdateMyLocation,
  useSubmitAnswers,
  useUpdateMyStance,
  type IssueStance,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MapPin, ArrowLeft, ArrowRight, Check, Sparkles, AlertCircle } from "lucide-react";
import neighborhood from "@/assets/neighborhood.webp";

type Phase = "location" | "questions" | "prioritize";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { data: profile } = useGetMyProfile();
  const {
    data: questions,
    isLoading: questionsLoading,
    isError: questionsError,
    refetch: refetchQuestions,
  } = useListQuestions();
  const updateLocation = useUpdateMyLocation();
  const submitAnswers = useSubmitAnswers();
  const updateStance = useUpdateMyStance();
  const invalidate = useInvalidateVoterData();

  const [phase, setPhase] = useState<Phase>("location");
  const [zip, setZip] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [stances, setStances] = useState<IssueStance[]>([]);
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => (questions ? [...questions].sort((a, b) => a.order - b.order) : []),
    [questions],
  );
  const total = sorted.length;
  const current = sorted[qIndex];
  const answeredCount = Object.keys(answers).length;

  const zipValid = /^\d{5}$/.test(zip.trim());

  // Pre-fill ZIP from a saved location once it loads (does not auto-advance).
  useEffect(() => {
    const saved = profile?.location?.zip;
    if (saved) setZip((z) => (z === "" ? saved : z));
  }, [profile?.location?.zip]);

  function submitLocation() {
    setError(null);
    updateLocation.mutate(
      { data: { zip: zip.trim() } },
      {
        onSuccess: () => {
          void invalidate();
          setPhase("questions");
        },
        onError: () => {
          setError("We couldn't save your location. Please check your connection and try again.");
        },
      },
    );
  }

  function choose(value: number) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
  }

  function next() {
    if (qIndex < total - 1) {
      setQIndex((i) => i + 1);
    } else {
      finishQuestions();
    }
  }

  function finishQuestions() {
    setError(null);
    const payload = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));
    submitAnswers.mutate(
      { data: { answers: payload, completeOnboarding: true } },
      {
        onSuccess: (prof) => {
          void invalidate();
          setStances(prof.stances ?? []);
          setPhase("prioritize");
        },
        onError: () => {
          setError(
            "We couldn't build your values profile just now. Please tap “See my priorities” again.",
          );
        },
      },
    );
  }

  function togglePriority(issueId: string) {
    setPriorities((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(issueId)) nextSet.delete(issueId);
      else if (nextSet.size < 5) nextSet.add(issueId);
      return nextSet;
    });
  }

  async function finish() {
    setFinishing(true);
    try {
      await Promise.all(
        [...priorities].map((issueId) =>
          updateStance.mutateAsync({ issueId, data: { importance: 3 } }),
        ),
      );
    } catch {
      // Non-fatal: onboarding is already complete; prioritization is a refinement.
    } finally {
      await invalidate();
      navigate("/matches");
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
      {phase === "location" && (
        <div className="space-y-8">
          <Header
            step={1}
            steps={3}
            title="Where do you vote?"
            subtitle="We use your ZIP code to find the candidates on your ballot — your representatives and senators in Congress."
          />
          <Card className="overflow-hidden">
            <div className="relative h-32 w-full md:h-40">
              <img
                src={neighborhood}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            </div>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP code</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="zip"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="e.g. 94103"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && zipValid && submitLocation()}
                    className="pl-9"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your data is private and never shared. You can change this anytime.
                </p>
              </div>
              <Button
                className="w-full h-12"
                disabled={!zipValid || updateLocation.isPending}
                onClick={submitLocation}
              >
                {updateLocation.isPending ? "Saving…" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {error && <ErrorNote message={error} />}
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "questions" && (
        <div className="space-y-8">
          <Header
            step={2}
            steps={3}
            title="Tell us what you believe"
            subtitle="There are no right answers. Respond honestly — we'll turn this into your values profile."
          />
          {questionsError ? (
            <div className="space-y-4">
              <ErrorNote message="We couldn't load the questions. Please check your connection and try again." />
              <Button
                variant="outline"
                className="h-12 w-full sm:w-auto"
                onClick={() => {
                  void refetchQuestions();
                }}
              >
                Try again
              </Button>
            </div>
          ) : questionsLoading || !current ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="font-medium text-primary line-clamp-1 mr-2">{current.issueName}</span>
                  <span className="shrink-0">
                    {qIndex + 1} of {total}
                  </span>
                </div>
                <Progress value={((qIndex + 1) / total) * 100} />
              </div>

              <Card>
                <CardContent className="space-y-5 pt-6">
                  <div>
                    <h2 className="text-xl font-semibold leading-snug">{current.prompt}</h2>
                    {current.helpText && (
                      <p className="mt-2 text-sm text-muted-foreground">{current.helpText}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {current.options.map((opt) => {
                      const selected = answers[current.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => choose(opt.value)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border p-3 md:p-4 text-left transition hover-elevate min-h-[3rem]",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border mt-0.5",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span>
                            <span className="font-medium">{opt.label}</span>
                            {opt.description && (
                              <span className="block text-sm text-muted-foreground mt-0.5">
                                {opt.description}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  className="h-12"
                  disabled={qIndex === 0}
                  onClick={() => {
                    setError(null);
                    setQIndex((i) => Math.max(0, i - 1));
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    variant="outline"
                    className="h-12"
                    disabled={submitAnswers.isPending}
                    onClick={next}
                  >
                    {qIndex === total - 1 ? "Skip" : "Not sure · Skip"}
                  </Button>
                  <Button
                    className="h-12"
                    disabled={answers[current.id] === undefined || submitAnswers.isPending}
                    onClick={next}
                  >
                    {qIndex === total - 1
                      ? submitAnswers.isPending
                        ? "Building your profile…"
                        : "See my priorities"
                      : "Next"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 pt-1 text-center">
                <button
                  type="button"
                  disabled={submitAnswers.isPending || answeredCount === 0}
                  onClick={finishQuestions}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {submitAnswers.isPending
                    ? "Building your profile…"
                    : `Finish early with ${answeredCount} answer${answeredCount === 1 ? "" : "s"}`}
                </button>
                <p className="text-xs text-muted-foreground">
                  You can skip any question — we only score issues you weigh in on, and you can come
                  back anytime.
                </p>
              </div>
              {error && <ErrorNote message={error} />}
            </div>
          )}
        </div>
      )}

      {phase === "prioritize" && (
        <div className="space-y-8">
          <Header
            step={3}
            steps={3}
            title="What matters most?"
            subtitle="Pick up to 5 issues you care about most. These will weigh more heavily when we score your matches."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {stances.map((s) => {
              const selected = priorities.has(s.issueId);
              return (
                <button
                  key={s.issueId}
                  type="button"
                  onClick={() => togglePriority(s.issueId)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 md:p-4 text-left transition hover-elevate min-h-[3rem]",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="font-medium break-words pr-2">{s.issueName}</span>
                  {selected && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                      <Sparkles className="h-3.5 w-3.5" /> Top priority
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <span className="text-sm text-muted-foreground">{priorities.size} of 5 selected</span>
            <Button onClick={finish} disabled={finishing} className="w-full sm:w-auto h-12">
              {finishing ? "Finishing…" : "See my matches"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function Header({
  step,
  steps,
  title,
  subtitle,
}: {
  step: number;
  steps: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Step {step} of {steps}
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}
