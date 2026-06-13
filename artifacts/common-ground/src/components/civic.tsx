import { cn } from "@/lib/utils";
import { issueIcon, gradeClasses, alignmentMeta } from "@/lib/issue-meta";

export function IssueIcon({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Icon = issueIcon(icon);
  return <Icon className={className} />;
}

export function GradeBadge({
  grade,
  size = "md",
  className,
}: {
  grade: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { text, bg } = gradeClasses(grade);
  const sizes = {
    sm: "h-8 w-8 text-base",
    md: "h-12 w-12 text-xl",
    lg: "h-16 w-16 text-3xl",
  };
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl font-bold tracking-tight",
        bg,
        text,
        sizes[size],
        className,
      )}
    >
      {grade}
    </div>
  );
}

export function ScoreRing({
  score,
  grade,
  size = 88,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const { text, ring } = gradeClasses(grade);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={ring}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className={cn("text-2xl font-bold", text)}>{Math.round(score)}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">match</span>
      </div>
    </div>
  );
}

export function AlignmentBadge({ alignment }: { alignment: number }) {
  const { label, className } = alignmentMeta(alignment);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}

/**
 * A non-partisan position scale from -2 to +2. Poles are intentionally unlabeled
 * (no left/right) — it only visualizes distance between two coordinates.
 */
export function PositionScale({
  voterPosition,
  candidatePosition,
}: {
  voterPosition?: number | null;
  candidatePosition?: number | null;
}) {
  const toPct = (v: number) => ((v + 2) / 4) * 100;
  return (
    <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-muted via-secondary to-muted">
      {typeof candidatePosition === "number" && (
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
          style={{ left: `${toPct(candidatePosition)}%` }}
          title="Candidate"
        />
      )}
      {typeof voterPosition === "number" && (
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
          style={{ left: `${toPct(voterPosition)}%` }}
          title="You"
        />
      )}
    </div>
  );
}
