import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ShieldOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listAdminUsers } from "@/lib/diagnostics.functions";
import { adminSetRole } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/permissions")({
  head: () => ({ meta: [{ title: "Permissions — CoreEgin Sales OS" }] }),
  component: PermissionsPage,
});

type Row = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  role: "owner" | "rep";
  leads: Array<{ id: string; name: string; stage: string; custom_status: string | null }>;
};

function PermissionsPage() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && role !== "owner") navigate({ to: "/dashboard", replace: true }); }, [loading, role, navigate]);

  const listUsers = useServerFn(listAdminUsers);
  const setRoleFn = useServerFn(adminSetRole);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastVerified, setLastVerified] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    try {
      const { users } = await listUsers();
      setRows(users as Row[]);
      setLastVerified(new Date().toLocaleTimeString());
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function changeRole(userId: string, next: "owner" | "rep") {
    setSaving(userId);
    try {
      await setRoleFn({ data: { userId, role: next } });
      toast.success(`Role updated to ${next}. Re-verifying RLS…`);
      await refresh();
      toast.success("RLS re-verified — lead visibility recalculated.");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(null); }
  }

  return (
    <>
      <PageHeader
        title="Permissions & RLS"
        description="Every user, their role, and exactly which leads their session can see. Change a role and RLS is re-verified live."
        actions={
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className={"h-3.5 w-3.5 mr-1.5 " + (busy ? "animate-spin" : "")} />Re-verify RLS
          </Button>
        }
      />
      <div className="p-6 md:p-8 space-y-4">
        {lastVerified && (
          <div className="surface p-3 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Last verified at <b className="tabular text-foreground">{lastVerified}</b> · policies enforced via Postgres RLS + <code className="text-[10px]">private.has_role()</code>
          </div>
        )}

        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Leads visible</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px]">Change role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {busy && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <>
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      {r.role === "owner" ? (
                        <Badge className="bg-primary/15 text-primary border-0 hover:bg-primary/15"><ShieldCheck className="h-3 w-3 mr-1" />Owner</Badge>
                      ) : (
                        <Badge variant="secondary" className="border-0">Rep</Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular">
                      <span className="font-medium">{r.leads.length}</span>
                      <span className="text-xs text-muted-foreground ml-1">lead{r.leads.length === 1 ? "" : "s"}</span>
                    </TableCell>
                    <TableCell>
                      {r.is_active ? <span className="text-xs text-success">Active</span> : <span className="text-xs text-muted-foreground flex items-center gap-1"><ShieldOff className="h-3 w-3" />Inactive</span>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={r.role}
                        disabled={saving === r.id}
                        onValueChange={(v) => {
                          if (v !== r.role && confirm(`Change ${r.name} to ${v.toUpperCase()}?\n\nRLS will be re-verified immediately.`)) {
                            changeRole(r.id, v as "owner" | "rep");
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rep">Rep — only own leads</SelectItem>
                          <SelectItem value="owner">Owner — full access</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  {expanded === r.id && (
                    <TableRow key={r.id + "-x"}>
                      <TableCell colSpan={5} className="bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-2">
                          RLS proof — these are the exact leads this user's JWT can currently read:
                        </div>
                        {r.leads.length === 0 ? (
                          <div className="text-xs italic text-muted-foreground">No leads assigned. {r.role === "rep" && "Rep sees an empty pipeline — this is correct."}</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {r.leads.map((l) => (
                              <span key={l.id} className="inline-flex items-center gap-1 rounded-md bg-background ring-1 ring-border px-2 py-0.5 text-[11px]">
                                <span className="h-1 w-1 rounded-full bg-primary" />{l.name}
                                <span className="text-muted-foreground">· {l.stage}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="surface p-4 text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground text-sm mb-1">How RLS is enforced</div>
          <div>• <b>Owner</b> policies: <code>private.has_role(auth.uid(), 'owner')</code> → sees every row in the org.</div>
          <div>• <b>Rep</b> policies: <code>assigned_to = auth.uid()</code> → only rows explicitly assigned to them.</div>
          <div>• Role changes take effect on the user's <b>next request</b> — no server restart, no cache to bust.</div>
        </div>
      </div>
    </>
  );
}