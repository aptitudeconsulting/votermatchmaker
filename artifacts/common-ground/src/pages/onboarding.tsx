import { useMemo, useState } from "react";
import { useLocation } from "wouter";
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
import { MapPin, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

type Phase = "location" | "questions" | "prioritize";

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { data: profile } = useGetMyProfile();
  const { data: questions, isLoading: questionsLoading } = useListQuestions();
  const updateLocation = useUpdateMyLocation();
  const submitAnswers = useSubmitAnswers();
  const updateStance = useUpdateMyStance();

  const [phase, setPhase] = useState<Phase>("location");
  const [zip, setZip] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [stances, setStances] = useState<IssueStance[]>([]);
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  const sorted = useMemo(
    () => (questions ? [...questions].sort((a, b) => a.order - b.order) : []),
    [questions],
  );
  const total = sorted.length;
  const current = sorted[qIndex];

  const zipValid = /^\d{5}$/.test(zip.trim());

  function submitLocation() {
    updateLocation.mutate(
      { data: { zip: zip.trim() } },
      { onSuccess: () => setPhase("questions") },
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
    const payload = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));
    submitAnswers.mutate(
      { data: { answers: payload, completeOnboarding: true } },
      {
        onSuccess: (prof) => {
          setStances(prof.stances ?? []);
          setPhase("prioritize");
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
      navigate("/matches");
    }
  }

  // Skip the location step if the voter already has one saved.
  if (phase === "location" && profile?.location?.zip && zip === "") {
    setZip(profile.location.zip);
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 md:py-16">
      {phase === "location" && (
        <div className="space-y-8">
          <Header
            step={1}
            steps={3}
            title="Where do you vote?"
            subtitle="We use your ZIP code to find the candidates on your ballot — your representatives in Congress and sample local races."
          />
          <Card>
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
                className="w-full"
                disabled={!zipValid || updateLocation.isPending}
                onClick={submitLocation}
              >
                {updateLocation.isPending ? "Saving…" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
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
          {questionsLoading || !current ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="font-medium text-primary">{current.issueName}</span>
                  <span>
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
                            "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover-elevate",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
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
                              <span className="block text-sm text-muted-foreground">
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

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  disabled={qIndex === 0}
                  onClick={() => setQIndex((i) => Math.max(0, i - 1))}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
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
                    "flex items-center justify-between rounded-xl border p-3 text-left transition hover-elevate",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                  )}
                >
                  <span className="font-medium">{s.issueName}</span>
                  {selected && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3.5 w-3.5" /> Top priority
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{priorities.size} of 5 selected</span>
            <Button onClick={finish} disabled={finishing}>
              {finishing ? "Finishing…" : "See my matches"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
