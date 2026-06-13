import { useGetStatsOverview } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, CheckCircle2, Building2 } from "lucide-react";

export default function Home() {
  const { data: stats, isLoading } = useGetStatsOverview();

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full px-4 py-24 md:py-32 flex flex-col items-center text-center bg-gradient-to-b from-background to-secondary/20">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Find the candidates who <span className="text-primary">actually align</span> with your values.
          </h1>
          <p className="text-xl text-muted-foreground">
            Skip the attack ads and political noise. Build your personal issues graph and see which candidates match your real priorities, backed by their actual legislative record.
          </p>
          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8 py-6 rounded-full hover-elevate">
                Find Your Matches
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/candidates">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 rounded-full hover-elevate">
                Browse Candidates
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-16 bg-white border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x border-border">
            <div className="p-6 flex flex-col items-center">
              <Users className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats?.candidateCount?.toLocaleString() || "0"}
              </h3>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Candidates Tracked</p>
            </div>
            <div className="p-6 flex flex-col items-center">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats?.issueCount?.toLocaleString() || "0"}
              </h3>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Key Issues</p>
            </div>
            <div className="p-6 flex flex-col items-center">
              <Building2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-4xl font-bold mb-2">
                {isLoading ? "..." : stats?.recordCount?.toLocaleString() || "0"}
              </h3>
              <p className="text-muted-foreground font-medium uppercase tracking-wider text-sm">Legislative Records</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full py-24 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Common Ground Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A transparent, non-partisan approach to finding your political matches.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border -z-10" />

            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary text-2xl font-bold shadow-sm">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Share Your Values</h3>
              <p className="text-muted-foreground">
                Take our engaging onboarding flow to map out where you stand on key issues and how important they are to you.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary text-2xl font-bold shadow-sm">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">We Analyze Records</h3>
              <p className="text-muted-foreground">
                We compare your stances against the actual voting records, sponsorships, and public statements of candidates.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary text-2xl font-bold shadow-sm">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">See Your Matches</h3>
              <p className="text-muted-foreground">
                Get a personalized scorecard for candidates in your area, showing exactly where you agree and disagree.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="w-full py-20 bg-primary text-primary-foreground text-center px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to vote your values?</h2>
          <p className="text-primary-foreground/80 text-lg">
            Join thousands of voters making informed decisions based on data, not rhetoric.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6 rounded-full hover-elevate font-bold">
              Start Your Profile
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
