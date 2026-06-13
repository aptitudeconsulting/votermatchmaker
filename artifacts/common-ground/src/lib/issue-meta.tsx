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
