export const STAGES = [
  { key: "new", label: "New Lead" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "meeting_scheduled", label: "Meeting" },
  { key: "proposal_sent", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<StageKey, string>;

export const PIPELINE_STAGES = STAGES.filter((s) => s.key !== "lost");

// Stages that appear on the drag-and-drop board by default (active work only).
export const ACTIVE_STAGES = STAGES.filter(
  (s) => s.key !== "won" && s.key !== "lost",
);

// Visual accent per stage — used by pipeline column headers and lead badges.
export const STAGE_ACCENT: Record<StageKey, { dot: string; bg: string; text: string; ring: string; label: string }> = {
  new:               { dot: "bg-slate-400",   bg: "bg-slate-50",   text: "text-slate-700",   ring: "ring-slate-200",   label: "New" },
  contacted:         { dot: "bg-sky-400",     bg: "bg-sky-50",     text: "text-sky-700",     ring: "ring-sky-200",     label: "Contacted" },
  interested:        { dot: "bg-violet-400",  bg: "bg-violet-50",  text: "text-violet-700",  ring: "ring-violet-200",  label: "Warm" },
  meeting_scheduled: { dot: "bg-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200",   label: "Meeting" },
  proposal_sent:    { dot: "bg-primary",     bg: "bg-primary/10", text: "text-primary",     ring: "ring-primary/30",  label: "Proposal" },
  won:               { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", label: "Won" },
  lost:              { dot: "bg-rose-400",    bg: "bg-rose-50",    text: "text-rose-700",    ring: "ring-rose-200",    label: "Lost" },
};

export const SOURCES = [
  { key: "website", label: "Website" },
  { key: "referral", label: "Referral" },
  { key: "cold_outreach", label: "Cold Outreach" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "other", label: "Other" },
] as const;

export type SourceKey = (typeof SOURCES)[number]["key"];

export const ACTIVITY_TYPES = [
  { key: "call", label: "Call" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "meeting", label: "Meeting" },
  { key: "note", label: "Note" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number]["key"];

export const LOST_REASONS = [
  "Price",
  "Timing",
  "Competitor",
  "No response",
  "Other",
] as const;

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";