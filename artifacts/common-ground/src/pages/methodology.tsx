import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Scale,
  Vote,
  Wallet,
  Sparkles,
  ShieldCheck,
  Database,
  ArrowRight,
} from "lucide-react";

export default function Methodology() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          How Voter Compass works
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Every match is built from public records, not campaign rhetoric. Here's
          exactly where the data comes from and how we turn it into a score.
        </p>
      </div>

      <div className="mt-10 space-y-6">
        <Section
          icon={<Scale className="h-5 w-5" />}
          title="Positions come from the legislative record"
        >
          A candidate's stance on each issue is <em>derived</em> from the bills
          they sponsored and cosponsored in Congress. We map each bill's policy
          area to one of our issues and place the candidate on an internal scale
          for that issue. We never use campaign statements, slogans, or ads.
        </Section>

        <Section
          icon={<Vote className="h-5 w-5" />}
          title="Actual floor votes move the needle"
        >
          On top of sponsorship, we layer in real roll-call floor votes. Only
          substantive passage votes on actual legislation count — procedural,
          cloture, and rule-adoption votes are excluded. Votes can shift a
          position and raise our confidence in it, because they reflect what a
          member actually did, not just what they signed onto.
        </Section>

        <Section
          icon={<Wallet className="h-5 w-5" />}
          title="Donor money is context, never a verdict"
        >
          Campaign-finance data from the FEC is shown as additional context. It
          never changes a candidate's position. It only adjusts our confidence
          when the money clearly agrees or conflicts with their record, and it can
          raise a neutral "donor tension" flag. Funding sectors are inferred from
          contributor and employer names, so they're approximate and always shown
          with their source.
        </Section>

        <Section
          icon={<Sparkles className="h-5 w-5" />}
          title="AI summaries are grounded and labeled"
        >
          Where you see an AI-generated summary of a candidate's record on an
          issue, it is written strictly from the official bill summaries behind
          that position — nothing else. AI content is always disclosed, and the
          underlying bills are linked so you can check the work yourself.
        </Section>

        <Section
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Strictly non-partisan"
        >
          We never ask who you'd vote for and never label you or any candidate as
          left or right. Internally, positions live on a neutral numeric scale
          that exists only so your values and a candidate's record can be compared
          as coordinates. There are no party scores, rankings, or endorsements.
        </Section>

        <Section
          icon={<Database className="h-5 w-5" />}
          title="Data sources"
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>Members, bills, and sponsorships — Congress.gov</li>
            <li>Roll-call floor votes — Congress.gov (House) and Senate.gov (Senate)</li>
            <li>Campaign finance — the Federal Election Commission (FEC)</li>
            <li>Ballot and election information — Google Civic Information API</li>
          </ul>
          <p className="mt-3">
            Records are refreshed on a regular schedule; the home page shows when
            each data set was last updated.
          </p>
        </Section>
      </div>

      <Card className="mt-10">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h2 className="text-xl font-semibold">See it for yourself</h2>
          <p className="max-w-md text-muted-foreground">
            Browse any member of Congress and expand a position to see the exact
            bills and votes behind it.
          </p>
          <Button asChild>
            <Link href="/candidates">
              Browse candidates <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </section>
  );
}
