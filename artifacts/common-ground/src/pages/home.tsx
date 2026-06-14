import { useGetStatsOverview } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Users,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Scale,
  Eye,
} from "lucide-react";
import heroVoters from "@/assets/hero-voters.webp";
import compassMap from "@/assets/compass-map.webp";

export default function Home() {
  const { data: stats, isLoading } = useGetStatsOverview();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden">
        <img
          src={heroVoters}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-950/90" />
        <div className="relative w-full px-4 py-28 md:py-40 flex flex-col items-center text-center">
          <div className="max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-teal-300" />
              Non-partisan · backed by real legislative records
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Find the candidates who{" "}
              <span className="text-teal-300">actually align</span> with your
              values.
            </h1>
            <p className="text-xl text-white/80">
              Skip the attack ads and political noise. Build your personal issues
              graph and see which candidates match your real priorities — backed
              by their actual votes, not their slogans.
            </p>
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
              <Show when="signed-out">
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-8 py-6 rounded-full hover-elevate"
                >
                  <Link href="/sign-up">
                    Find Your Matches
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </Show>
              <Show when="signed-in">
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-8 py-6 rounded-full hover-elevate"
                >
                  <Link href="/matches">
                    Go to Your Matches
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </Show>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/candidates">Browse Candidates</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section — floating card overlapping the hero */}
      <section className="relative z-10 w-full px-4 -mt-12 md:-mt-16">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x rounded-2xl border bg-card shadow-xl">
            <Stat
              icon={<Users className="h-7 w-7 text-primary" />}
              value={isLoading ? "…" : stats?.candidateCount?.toLocaleString() || "0"}
              label="Candidates Tracked"
            />
            <Stat
              icon={<CheckCircle2 className="h-7 w-7 text-primary" />}
              value={isLoading ? "…" : stats?.issueCount?.toLocaleString() || "0"}
              label="Key Issues"
            />
            <Stat
              icon={<Building2 className="h-7 w-7 text-primary" />}
              value={isLoading ? "…" : stats?.recordCount?.toLocaleString() || "0"}
              label="Legislative Records"
            />
          </div>
        </div>
      </section>

      {/* Values / credibility section */}
      <section className="w-full py-24 px-4">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-primary/10 -z-10" />
            <img
              src={compassMap}
              alt="A compass resting on a map, representing finding your direction"
              className="rounded-2xl shadow-lg w-full object-cover aspect-[4/3]"
            />
          </div>
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Your values, not party lines.
            </h2>
            <p className="text-lg text-muted-foreground">
              Voter Compass never asks who you'd vote for or labels you left or
              right. It maps where <em>you</em> stand, then measures how closely
              each candidate's record matches — issue by issue.
            </p>
            <ul className="space-y-4">
              <ValueRow
                icon={<Scale className="h-5 w-5" />}
                title="Measured by the record"
                body="Candidate positions are derived from sponsored and cosponsored legislation — what they actually did in office."
              />
              <ValueRow
                icon={<Eye className="h-5 w-5" />}
                title="Fully transparent"
                body="Every match shows its work: where you agree, where you don't, and how confident we are."
              />
              <ValueRow
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Strictly non-partisan"
                body="No party coding, no endorsements. Just your priorities compared to the evidence."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full py-24 px-4 bg-secondary/30 border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How Voter Compass Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A transparent, three-step path from your values to your matches.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border -z-10" />
            <Step
              n={1}
              title="Share Your Values"
              body="Answer a short, plain-language questionnaire to map where you stand on key issues and how much each one matters to you."
            />
            <Step
              n={2}
              title="We Analyze Records"
              body="We compare your stances against the real legislative records — votes, sponsorships, and bills — of candidates on your ballot."
            />
            <Step
              n={3}
              title="See Your Matches"
              body="Get a personalized scorecard for candidates in your area, showing exactly where you agree and disagree."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full py-20 bg-primary text-primary-foreground text-center px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to vote your values?
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            Build your profile in a few minutes and see your matches — free, and
            without the spin.
          </p>
          <Show when="signed-out">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6 rounded-full hover-elevate font-bold"
            >
              <Link href="/sign-up">
                Start Your Profile
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6 rounded-full hover-elevate font-bold"
            >
              <Link href="/matches">
                Go to Your Matches
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </Show>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="p-8 flex flex-col items-center text-center">
      <div className="mb-3">{icon}</div>
      <h3 className="text-4xl font-bold mb-2">{value}</h3>
      <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm">
        {label}
      </p>
    </div>
  );
}

function ValueRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary text-2xl font-bold shadow-sm ring-4 ring-background">
        {n}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}
