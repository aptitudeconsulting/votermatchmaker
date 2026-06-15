import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, ArrowRight, ArrowLeft } from "lucide-react";

const VERSION = "1.0";
const LAST_UPDATED = "June 2026";

export default function Whitepaper() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="print:hidden">
        <Link
          href="/methodology"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to How it works
        </Link>
      </div>

      <header className="mt-6 border-b pb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Methodology Whitepaper
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          How Voter Compass turns public records into a match
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A complete, transparent account of every data source, model, and
          formula behind the scores you see — so anyone can audit, reproduce, or
          challenge our work.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>Version {VERSION}</span>
          <span>Last updated {LAST_UPDATED}</span>
          <span>Non-partisan · open methodology</span>
        </div>
        <div className="mt-6 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </header>

      <Section n="1" title="Abstract">
        <p>
          Voter Compass is a non-partisan tool that matches a voter's stated
          priorities to candidates' records in the U.S. Congress. Unlike polls
          or campaign coverage, every candidate position is{" "}
          <em>derived from public legislative behavior</em> — the bills they
          sponsor, how they vote on the floor, and what those bills actually do —
          rather than from slogans, advertising, or our own opinion of where a
          candidate "should" sit. This paper documents the full pipeline: the
          neutral value axis, how positions are computed from legislation, how
          actual roll-call votes adjust them, how campaign-finance and AI signals
          are used (and deliberately limited), how a voter's answers become a
          ranked issue profile, and how the two are scored into a grade. We also
          state the privacy guarantees and the known limitations.
        </p>
      </Section>

      <Section n="2" title="Design principles">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Records over rhetoric.</strong> Positions are derived from
            what candidates legislated, not what they said.
          </li>
          <li>
            <strong>Strictly non-partisan.</strong> We never ask who you would
            vote for, never label you or a candidate as left or right, and never
            publish party scores, rankings, or endorsements.
          </li>
          <li>
            <strong>Honest uncertainty.</strong> When the evidence is too thin or
            too contradictory to assess a direction, we say so and exclude the
            issue from scoring rather than inventing a number or falling back to
            a party assumption.
          </li>
          <li>
            <strong>Auditable receipts.</strong> Every position links to the
            exact bills and votes behind it, with sources, so you can check the
            work yourself.
          </li>
          <li>
            <strong>Privacy by construction.</strong> Individual answers are
            never exposed; community statistics are aggregated and suppressed
            below a minimum sample size.
          </li>
        </ul>
      </Section>

      <Section n="3" title="The internal value axis">
        <p>
          Every issue is represented on an internal numeric axis from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">-2</code> to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">+2</code>. The
          orientation of this axis is <strong>arbitrary and never shown</strong>{" "}
          to users as left/right or party-coded. It exists for one purpose: so a
          voter's stance and a candidate's derived stance can be compared as
          coordinates on the same line. A position near 0 means "no clear lean";
          the poles represent the two directions a given policy debate can take,
          defined per issue only so the onboarding statements and the candidate
          model stay internally consistent.
        </p>
      </Section>

      <Section n="4" title="Data sources">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Members, bills, sponsorships, and official bill summaries</strong>{" "}
            — Congress.gov (including non-partisan CRS summaries).
          </li>
          <li>
            <strong>Roll-call floor votes</strong> — Congress.gov for the House;
            the official Senate.gov LIS record for the Senate (which has no
            Congress.gov votes API), with a Voteview/UCLA dataset as a fallback.
          </li>
          <li>
            <strong>Campaign finance</strong> — the Federal Election Commission
            (FEC).
          </li>
          <li>
            <strong>Ballot and election information</strong> — the Google Civic
            Information API, where available.
          </li>
        </ul>
        <p className="mt-3">
          Data is refreshed on a recurring schedule; the home page surfaces when
          each data set was last updated.
        </p>
      </Section>

      <Section n="5" title="Candidate positions from legislation">
        <p>
          The base position for a candidate on an issue is built{" "}
          <strong>only</strong> from per-bill stances. For each sponsored or
          cosponsored bill, we read its official CRS summary and classify three
          things: which issue it touches, its direction on that issue's axis
          (<code className="rounded bg-muted px-1 text-sm">-1</code>,{" "}
          <code className="rounded bg-muted px-1 text-sm">0</code>, or{" "}
          <code className="rounded bg-muted px-1 text-sm">+1</code>), and a 0–1
          classifier confidence. There are no party priors and no
          title-keyword guesses.
        </p>
        <p className="mt-3">
          Each classified bill is weighted by how strong a signal it is:
        </p>
        <Formula>
          weight = sponsorship × advancement × clarity × omnibus
        </Formula>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <strong>Sponsorship:</strong> sponsored = 1.0, cosponsored = 0.5.
          </li>
          <li>
            <strong>Advancement:</strong> became law = 1.5, passed a chamber =
            1.3, advanced = 1.1, merely introduced = 0.85, failed = 0.8. A bill
            that became law is far stronger evidence of a real commitment than a
            "messaging" bill introduced for a press release.
          </li>
          <li>
            <strong>Clarity:</strong> the classifier's confidence in that bill's
            direction.
          </li>
          <li>
            <strong>Omnibus penalty:</strong> sprawling catch-all bills are
            discounted (× 0.5) because they bundle many unrelated provisions.
          </li>
        </ul>
        <p className="mt-3">
          The position is the weighted-mean direction, scaled onto the axis:
        </p>
        <Formula>position = clamp(meanDirection × 2, -2, +2)</Formula>
        <p className="mt-3">
          Confidence combines three things — how much directional evidence there
          is (volume), how one-directional that evidence is (agreement), and the
          mean classifier clarity:
        </p>
        <Formula>
          confidence = (0.35 + 0.65 × volume) × agreement × (0.55 + 0.45 ×
          clarity)
        </Formula>
        <p className="mt-3">
          An issue is flagged <strong>insufficient</strong> — and excluded from
          scoring — when there is no directional evidence, when the total
          evidence weight is below 0.9, when confidence is below 0.35, or when
          the resulting position is within 0.25 of neutral. We never guess.
        </p>
      </Section>

      <Section n="6" title="Roll-call votes move the position">
        <p>
          Actual floor votes are the strongest form of legislative behavior, so —
          unlike every other secondary signal — they <strong>move</strong> the
          position rather than just adjusting confidence. We only count
          substantive passage votes on real legislation (bills and joint
          resolutions); procedural, cloture, motion-to-proceed, and
          rule-adoption votes are excluded because they do not reflect a clear
          policy stance.
        </p>
        <p className="mt-3">
          The vote-derived position is blended into the sponsorship base, with
          the vote share growing as the number of directional votes grows, capped
          at 70%:
        </p>
        <Formula>
          w = min(0.7, voteCount × 0.12)
          {"\n"}position = w × votePosition + (1 − w) × basePosition
        </Formula>
        <p className="mt-3">
          Votes also raise confidence (up to +0.35). A candidate with a genuine
          roll-call record on an issue can be scored on votes alone, even when
          their sponsorship record is too thin to assess.
        </p>
      </Section>

      <Section n="7" title="Campaign finance is context, never a verdict">
        <p>
          FEC donor data is a second, independent signal that{" "}
          <strong>never changes a candidate's position</strong>. It does two
          things only:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            When classified donor money clearly agrees in direction with the
            candidate's legislative record, it modestly raises our{" "}
            <em>confidence</em> in that position.
          </li>
          <li>
            When the money clearly points the opposite way, it lowers confidence
            and raises a neutral <em>"donor tension"</em> flag with a factual,
            one-line explanation.
          </li>
        </ul>
        <p className="mt-3">
          Funding sectors are <em>inferred</em> from contributor and employer
          names (the FEC has no industry codes), so they are approximate and
          always shown with their source. Conduits such as ActBlue and WinRed and
          a member's own committees are excluded, and noise employers
          (retired/self/not-employed) are filtered out. This applies to federal
          candidates only and degrades silently when data is missing.
        </p>
      </Section>

      <Section n="8" title="Bill provisions and AI summaries">
        <p>
          Two AI-assisted signals add transparency without ever moving a
          position:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Provisions</strong> — notable or unrelated (rider/earmark-like)
            items extracted from a bill's official CRS summary, surfaced with
            source links. On the match page we flag provisions whose direction
            opposes the signed-in voter's stance; this is used only for
            voter-relative conflict detection and is never shown as left/right.
          </li>
          <li>
            <strong>Issue summaries</strong> — a plain-language summary of a
            candidate's record on an issue, written strictly from the official
            bill summaries behind that position and nothing else. It returns
            nothing when there is no usable evidence.
          </li>
        </ul>
        <p className="mt-3">
          All AI-generated content is explicitly disclosed, and the underlying
          bills are linked so you can verify it.
        </p>
      </Section>

      <Section n="9" title="The voter profile">
        <p>
          During onboarding, voters answer value statements that place them on
          each issue's axis, then rank how much each issue matters to them
          (importance). Answering is progressive and optional: a voter can skip
          any question or finish early, and only the issues they actually
          answered count. The result is a ranked issue profile of (position,
          importance) pairs.
        </p>
      </Section>

      <Section n="10" title="The matching algorithm">
        <p>
          For each issue the voter cares about, we measure signed alignment
          between their position and the candidate's effective position (base +
          votes), where 1 means identical, 0 means one step apart, and -1 means
          opposite:
        </p>
        <Formula>alignment = clamp(1 − |voter − candidate| / 2, -1, +1)</Formula>
        <p className="mt-3">
          Each issue is weighted by how much it matters to the voter{" "}
          <em>and</em> how confident we are in the candidate's position, so
          high-conviction priorities and well-evidenced positions count most. The
          overall score is the confidence-and-importance-weighted average
          alignment, expressed 0–100:
        </p>
        <Formula>
          score = Σ(weight × alignment₀₁) / Σ(weight) × 100
          {"\n"}weight = importance × effectiveConfidence
        </Formula>
        <p className="mt-3">
          Scores map to letter grades (A+ ≥ 93 down to F &lt; 45) purely as a
          readability aid. We also report a <strong>coverage</strong> figure —
          how much of a voter's total priority weight we were actually able to
          assess — so a confident match on a thin record is never mistaken for a
          comprehensive one.
        </p>
      </Section>

      <Section n="11" title="Privacy and community statistics">
        <p>
          We never ask who you intend to vote for. Your individual answers are
          never shown to anyone. The only place voter data is exposed is the
          aggregate "how you compare" view, which reports a per-issue community
          average over the internal axis. Any issue with fewer than five
          contributing voters is withheld entirely, so no single person's stance
          can be reverse-engineered. The aggregate is framed purely descriptively
          ("everyone's average") and never as normal-versus-not or left/right.
        </p>
      </Section>

      <Section n="12" title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Scope is the current U.S. Congress (synced live) plus a small set of
            sample local races. Candidates without a federal legislative record
            cannot be assessed by the core model.
          </li>
          <li>
            Positions reflect a candidate's record to date; they lag real-world
            events by the cadence of official data publication, and CRS summaries
            can lag a bill's introduction.
          </li>
          <li>
            Issue and direction classification from bill summaries is automated
            and imperfect; the insufficient-record flag is our guard against
            over-claiming, but edge cases exist. The linked receipts let you
            judge.
          </li>
          <li>
            Donor sectors are name-inferred approximations, not official industry
            codes.
          </li>
          <li>
            The Senate has no official votes API, so Senate votes depend on
            parsing the LIS record (with a dataset fallback).
          </li>
        </ul>
      </Section>

      <Section n="13" title="References">
        <ul className="list-disc space-y-1 pl-5">
          <li>U.S. Congress — congress.gov (members, bills, CRS summaries, House votes)</li>
          <li>U.S. Senate — senate.gov (roll-call votes, LIS)</li>
          <li>Voteview, UCLA — roll-call dataset (Senate fallback)</li>
          <li>Federal Election Commission — fec.gov (campaign finance)</li>
          <li>Google Civic Information API (ballot and election data)</li>
          <li>unitedstates/congress-legislators (member identifier crosswalks)</li>
        </ul>
      </Section>

      <Card className="mt-12 print:hidden">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <h2 className="text-xl font-semibold">See the receipts yourself</h2>
          <p className="max-w-md text-muted-foreground">
            Open any member of Congress and expand a position to see the exact
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
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      <div className="mt-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm text-foreground">
      {children}
    </pre>
  );
}
