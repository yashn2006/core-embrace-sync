import { logActivity, updateLead } from "./leads";
import type { StageKey } from "./constants";

// Quick status presets reps use to update the owner on lead progress.
export const QUICK_STATUSES: {
  key: string;
  label: string;
  outcome: string;
  stage?: StageKey;
  tone: "neutral" | "positive" | "warm" | "negative";
}[] = [
  { key: "contacted", label: "Contacted", outcome: "Contacted", stage: "contacted", tone: "neutral" },
  { key: "no_answer", label: "No answer", outcome: "No answer", tone: "neutral" },
  { key: "callback", label: "Asked callback", outcome: "Callback requested", tone: "neutral" },
  { key: "replied_yes", label: "Replied — Yes", outcome: "Replied YES", stage: "interested", tone: "positive" },
  { key: "warm_5050", label: "50/50", outcome: "Warm / 50-50", stage: "interested", tone: "warm" },
  { key: "meeting_set", label: "Meeting set", outcome: "Meeting scheduled", stage: "meeting_scheduled", tone: "positive" },
  { key: "proposal_sent", label: "Proposal sent", outcome: "Proposal sent", stage: "proposal_sent", tone: "positive" },
  { key: "not_interested", label: "Not interested", outcome: "Not interested", tone: "negative" },
  { key: "done", label: "Work done", outcome: "Work delivered", tone: "positive" },
];

export async function applyQuickStatus(args: {
  leadId: string;
  userId: string;
  status: (typeof QUICK_STATUSES)[number];
  note?: string | null;
}) {
  await logActivity({
    lead_id: args.leadId,
    type: "note",
    outcome: args.status.outcome,
    response_text: args.note ?? null,
    created_by: args.userId,
  });
  if (args.status.stage) {
    await updateLead(args.leadId, { stage: args.status.stage });
  }
}