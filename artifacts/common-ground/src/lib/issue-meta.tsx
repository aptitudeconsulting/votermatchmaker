import {
  Banknote,
  HeartPulse,
  Globe,
  Leaf,
  GraduationCap,
  Shield,
  Stethoscope,
  Scale,
  Flag,
  Users,
  Home,
  Briefcase,
  Cpu,
  Vote,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  "heart-pulse": HeartPulse,
  globe: Globe,
  leaf: Leaf,
  "graduation-cap": GraduationCap,
  shield: Shield,
  stethoscope: Stethoscope,
  scale: Scale,
  flag: Flag,
  users: Users,
  home: Home,
  briefcase: Briefcase,
  cpu: Cpu,
  vote: Vote,
};

export function issueIcon(icon: string | null | undefined): LucideIcon {
  return (icon && ICONS[icon]) || CircleDot;
}

/** Stable issueId → icon-name map (mirrors the API seed in political.ts). */
const ICON_BY_ISSUE: Record<string, string> = {
  economy: "banknote",
  healthcare: "heart-pulse",
  immigration: "globe",
  climate: "leaf",
  education: "graduation-cap",
  guns: "shield",
  abortion: "stethoscope",
  "criminal-justice": "scale",
  "foreign-policy": "flag",
  "civil-rights": "users",
  housing: "home",
  labor: "briefcase",
  technology: "cpu",
  democracy: "vote",
};

/** Resolve an issue's icon directly from its id (stances don't carry an icon). */
export function issueIconById(issueId: string): LucideIcon {
  return issueIcon(ICON_BY_ISSUE[issueId]);
}

export type ImportanceMeta = {
  tier: 1 | 2 | 3;
  label: string;
  /** Icon chip background + text. */
  chip: string;
  /** Label / accent text color. */
  text: string;
  /** Left accent border color. */
  border: string;
  /** Subtle row background tint. */
  rowBg: string;
};

/** Importance value (1..3) → tier label + non-partisan emphasis styling. */
export function importanceMeta(importance: number): ImportanceMeta {
  if (importance >= 3) {
    return {
      tier: 3,
      label: "Top priority",
      chip: "bg-primary text-primary-foreground",
      text: "text-primary",
      border: "border-l-primary",
      rowBg: "bg-primary/5",
    };
  }
  if (importance <= 1) {
    return {
      tier: 1,
      label: "Minor",
      chip: "bg-muted text-muted-foreground",
      text: "text-muted-foreground",
      border: "border-l-transparent",
      rowBg: "bg-transparent",
    };
  }
  return {
    tier: 2,
    label: "Important",
    chip: "bg-primary/10 text-primary",
    text: "text-primary/90",
    border: "border-l-primary/40",
    rowBg: "bg-transparent",
  };
}

/** Color classes keyed by letter grade (A+..F). Non-partisan, agreement-based. */
export function gradeClasses(grade: string): { text: string; bg: string; ring: string } {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return { text: "text-emerald-700", bg: "bg-emerald-50", ring: "stroke-emerald-500" };
    case "B":
      return { text: "text-teal-700", bg: "bg-teal-50", ring: "stroke-teal-500" };
    case "C":
      return { text: "text-amber-700", bg: "bg-amber-50", ring: "stroke-amber-500" };
    case "D":
      return { text: "text-orange-700", bg: "bg-orange-50", ring: "stroke-orange-500" };
    default:
      return { text: "text-rose-700", bg: "bg-rose-50", ring: "stroke-rose-500" };
  }
}

/** Maps an alignment score (-1..1) to a neutral agreement label + color. */
export function alignmentMeta(alignment: number): { label: string; className: string } {
  if (alignment >= 0.5) return { label: "Strong agreement", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (alignment >= 0.15) return { label: "Lean agree", className: "text-teal-700 bg-teal-50 border-teal-200" };
  if (alignment > -0.15) return { label: "Mixed", className: "text-amber-700 bg-amber-50 border-amber-200" };
  if (alignment > -0.5) return { label: "Lean disagree", className: "text-orange-700 bg-orange-50 border-orange-200" };
  return { label: "Strong disagreement", className: "text-rose-700 bg-rose-50 border-rose-200" };
}

/** Importance value (1..3) → label. */
export function importanceLabel(importance: number): string {
  if (importance >= 3) return "Top priority";
  if (importance <= 1) return "Minor";
  return "Important";
}

/** Confidence (0..1) → label for how strong the legislative evidence is. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return "Strong record";
  if (confidence >= 0.45) return "Moderate record";
  if (confidence >= 0.25) return "Limited record";
  return "Inferred";
}
