import { useState, type KeyboardEvent } from "react";
import { X, Tag as TagIcon, Plus } from "lucide-react";
import { updateLeadTags, logActivity } from "@/lib/leads";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const SUGGESTED = ["VIP", "Referral", "Retainer", "Warm intro", "Cold", "Newsletter", "Enterprise", "SMB"];

export function TagsEditor({ leadId, value, onChanged }: { leadId: string; value: string[]; onChanged: () => void }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const tags = value ?? [];

  async function commit(next: string[]) {
    setBusy(true);
    try {
      await updateLeadTags(leadId, next);
      const added = next.filter((t) => !tags.includes(t));
      const removed = tags.filter((t) => !next.includes(t));
      if (added.length || removed.length) {
        await logActivity({
          lead_id: leadId,
          type: "note",
          outcome: `tags ${added.length ? "+ " + added.join(", ") : ""}${added.length && removed.length ? " · " : ""}${removed.length ? "− " + removed.join(", ") : ""}`.trim(),
          created_by: user!.id,
        });
      }
      onChanged();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  }

  function addTag(t: string) {
    const v = t.trim();
    if (!v || tags.includes(v)) return;
    commit([...tags, v]);
    setDraft("");
  }
  function removeTag(t: string) { commit(tags.filter((x) => x !== t)); }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(draft); }
    else if (e.key === "Backspace" && !draft && tags.length) { removeTag(tags[tags.length - 1]); }
  }

  return (
    <div className="rounded-lg border border-hairline bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <TagIcon className="h-3 w-3" />Tags
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-hairline bg-background px-2 py-1.5 min-h-9">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5">
            {t}
            <button type="button" onClick={() => removeTag(t)} className="hover:bg-primary/20 rounded-full" aria-label={`Remove ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && addTag(draft)}
          placeholder={tags.length ? "" : "Add tag and press Enter…"}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {SUGGESTED.filter((s) => !tags.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => addTag(s)}
            className="inline-flex items-center gap-1 text-[10px] rounded-full bg-background hover:bg-primary/10 hover:text-primary border border-hairline px-2 py-0.5 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />{s}
          </button>
        ))}
      </div>
    </div>
  );
}