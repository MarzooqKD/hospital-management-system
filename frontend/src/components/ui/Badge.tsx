import type { HTMLAttributes } from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-accent-500/10 text-accent-600 ring-accent-500/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}

/** Status vocabulary spanning every module (appointments, queue,
 * consultation, lab, pharmacy, inventory, admissions, referrals) — one
 * mapping so "green always means done/available" holds everywhere status
 * appears, per the redesign brief's semantic-color rule. Add to this list
 * rather than inventing a one-off tone at a call site. */
const STATUS_TONE: Record<string, Tone> = {
  // success / done / available
  completed: "success",
  dispensed: "success",
  available: "success",
  in_stock: "success",
  validated: "success",
  confirmed: "success",
  active: "success",
  discharged: "success",
  // informational / in progress / neutral-forward states
  scheduled: "info",
  checked_in: "info",
  in_progress: "info",
  in_consultation: "info",
  sample_collected: "info",
  admitted: "info",
  // pending / waiting / needs attention soon
  pending: "warning",
  waiting: "warning",
  requested: "warning",
  partially_dispensed: "warning",
  low_stock: "warning",
  due_soon: "warning",
  outstanding: "warning",
  // urgent / negative / stop
  cancelled: "danger",
  urgent: "danger",
  overdue: "danger",
  out_of_stock: "danger",
  no_show: "danger",
  emergency: "danger",
};

export function StatusPill({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <Badge tone={tone} className={className}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
