import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, ShieldCheck, ShieldOff, Sparkles, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminSetRole, adminDeactivateUser } from "@/lib/admin.functions";
import { toast } from "sonner";
import { BulkAssignDialog } from "@/components/leads/bulk-assign-dialog";
import { listLeads, type Profile } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — CoreEgin Sales OS" }] }),
  component: TeamPage,
});

interface Member {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: "owner" | "rep";
  leads_count: number;
}

function TeamPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [loading, role, navigate]);

  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [assign, setAssign] = useState<{ open: boolean; repId: string | null; repName: string | null }>({ open: false, repId: null, repName: null });
  const [profiles, setProfiles] = useState<Profile[]>([]);

  async function refresh() {
    setBusy(true);
    try {
      const [{ data: profs }, { data: roles }, { data: leads }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("leads").select("assigned_to"),
      ]);
      const list: Member[] = (profs ?? []).map((p) => {
        const isOwner = (roles ?? []).some((r) => r.user_id === p.id && r.role === "owner");
        const count = (leads ?? []).filter((l) => l.assigned_to === p.id).length;
        return { id: p.id, name: p.name, email: p.email, is_active: p.is_active, role: isOwner ? "owner" : "rep", leads_count: count };
      });
      setMembers(list.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1)));
      setProfiles((profs ?? []) as Profile[]);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);

  const setRoleFn = useServerFn(adminSetRole);
  const deactivateFn = useServerFn(adminDeactivateUser);

  async function toggleRole(m: Member) {
    const next = m.role === "owner" ? "rep" : "owner";
    try { await setRoleFn({ data: { userId: m.id, role: next } }); toast.success("Role updated"); refresh(); } catch (e: any) { toast.error(e.message); }
  }
  async function toggleActive(m: Member) {
    try { await deactivateFn({ data: { userId: m.id, active: !m.is_active } }); toast.success(m.is_active ? "Deactivated" : "Reactivated"); refresh(); } catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Team"
        description="Create accounts for your sales reps. Assign roles. Manage access."
        actions={<Button size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4 mr-1.5" />Create user</Button>}
      />
      <div className="p-6 md:p-8">
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {busy && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
              {!busy && members.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No members yet.</TableCell></TableRow>}
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: "var(--gradient-magenta)" }}>{m.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.role === "owner" ? (
                      <Badge className="bg-primary/10 text-primary border-transparent gap-1 hover:bg-primary/20"><Sparkles className="h-3 w-3" />Founder</Badge>
                    ) : <Badge variant="outline">Sales Rep</Badge>}
                  </TableCell>
                  <TableCell className="tabular">{m.leads_count}</TableCell>
                  <TableCell>{m.is_active ? <span className="text-xs text-success">Active</span> : <span className="text-xs text-muted-foreground">Deactivated</span>}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {m.role === "rep" && (
                      <Button size="sm" variant="ghost" onClick={() => setAssign({ open: true, repId: m.id, repName: m.name })}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" />Assign leads
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleRole(m)}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Make {m.role === "owner" ? "rep" : "owner"}</Button>
                    <Button size="sm" variant="ghost" className={m.is_active ? "text-destructive" : ""} onClick={() => toggleActive(m)}><ShieldOff className="h-3.5 w-3.5 mr-1" />{m.is_active ? "Deactivate" : "Reactivate"}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateUserDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(created) => {
          refresh();
          if (created?.role === "rep") {
            setAssign({ open: true, repId: created.id, repName: created.name });
          }
        }}
      />
      <BulkAssignDialog
        open={assign.open}
        onOpenChange={(v) => setAssign((s) => ({ ...s, open: v }))}
        profiles={profiles}
        presetRepId={assign.repId}
        presetRepName={assign.repName}
        onDone={refresh}
      />
    </>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (created: { id: string; name: string; role: "owner" | "rep" } | null) => void }) {
  const createFn = useServerFn(adminCreateUser);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "rep" as "owner" | "rep" });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) { toast.error("Fill all fields (password ≥ 8 chars)"); return; }
    setSaving(true);
    try {
      const created = await createFn({ data: form });
      toast.success("User created — they can log in now");
      const snapshot = { id: (created as any).id as string, name: form.name, role: form.role };
      setForm({ name: "", email: "", password: "", phone: "", role: "rep" });
      onOpenChange(false); onCreated(snapshot);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ali Khan" /></div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ali@coreegin.com" /></div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Phone (optional)</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98xxxxxxx" /></div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars" /></div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rep">Sales Rep</SelectItem>
                <SelectItem value="owner">Founder / Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-[11px] text-muted-foreground">User will sign in with this email and password immediately — no email verification required.</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create user"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}