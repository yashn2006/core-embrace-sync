import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOST_REASONS } from "@/lib/constants";
import { logActivity, recordLostReason, updateLead, type Lead } from "@/lib/leads";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Trophy, XCircle } from "lucide-react";

export function WonDialog({ open, onOpenChange, lead, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; lead: Lead | null; onDone: () => void }) {
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handle() {
    if (!lead || !user) return;
    const num = value ? Number(value) : lead.deal_value;
    setSaving(true);
    try {
      await updateLead(lead.id, { stage: "won", deal_value: num, won_at: new Date().toISOString(), handoff_note: note || null });
      await logActivity({ lead_id: lead.id, type: "note", outcome: "won", response_text: note || null, created_by: user.id });
      toast.success("Deal won 🎉");
      onDone();
      onOpenChange(false);
      setValue(""); setNote("");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Mark as won</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Final deal value ($)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={lead?.deal_value ? String(lead.deal_value) : "0"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Handoff note (optional)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kickoff notes for the delivery team…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handle} disabled={saving}>{saving ? "Saving…" : "Confirm won"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LostDialog({ open, onOpenChange, lead, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; lead: Lead | null; onDone: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>(LOST_REASONS[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handle() {
    if (!lead || !user) return;
    setSaving(true);
    try {
      await updateLead(lead.id, { stage: "lost", lost_at: new Date().toISOString() });
      await recordLostReason(lead.id, reason, note || null, user.id);
      await logActivity({ lead_id: lead.id, type: "note", outcome: `lost: ${reason}`, response_text: note || null, created_by: user.id });
      toast.success("Marked as lost");
      onDone();
      onOpenChange(false);
      setNote("");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Mark as lost</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handle} disabled={saving}>{saving ? "Saving…" : "Confirm lost"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}