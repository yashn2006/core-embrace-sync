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