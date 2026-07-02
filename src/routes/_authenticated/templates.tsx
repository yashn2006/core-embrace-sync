import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Copy, Pencil, Plus, Search, Sparkles, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, TEMPLATE_CATEGORIES, type MessageTemplate } from "@/lib/templates";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({ meta: [{ title: "Templates — CoreEgin Sales OS" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [edit, setEdit] = useState<MessageTemplate | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setItems(await listTemplates()); }
    catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (t && ![i.title, i.body].some((v) => v.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [items, q, category]);

  const byCat = useMemo(() => {
    const g: Record<string, MessageTemplate[]> = {};
    for (const it of filtered) (g[it.category] ??= []).push(it);
    return g;
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable message snippets. Use {{name}}, {{company}}, {{first_name}} for personalisation."
        actions={
          <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />New template
          </Button>
        }
      />
      <div className="p-6 md:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground tabular">{filtered.length} of {items.length}</div>
        </div>

        {loading && <div className="surface p-8 text-sm text-muted-foreground text-center">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="surface p-10 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--gradient-magenta)" }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="font-semibold">No templates yet</div>
            <div className="text-sm text-muted-foreground max-w-md mx-auto">Save your best-performing pitches, follow-ups, and closes. Anyone in the team can insert them in a lead chat with one click.</div>
            <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Create your first</Button>
          </div>
        )}

        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{cat}</div>
              <div className="text-[10px] tabular text-muted-foreground">{list.length}</div>
              <div className="flex-1 h-px bg-hairline" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.map((t) => (
                <div key={t.id} className="surface p-4 space-y-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><FileText className="h-3.5 w-3.5 text-primary" /></div>
                      <div className="font-medium text-sm truncate">{t.title}</div>
                    </div>
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(t.body); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEdit(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={async () => {
                        if (!confirm(`Delete "${t.title}"?`)) return;
                        try { await deleteTemplate(t.id); toast.success("Deleted"); refresh(); } catch (e: any) { toast.error(e.message); }
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{t.body}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <TemplateEditor
        open={open}
        onOpenChange={setOpen}
        template={edit}
        onSaved={() => { setOpen(false); refresh(); }}
        userId={user!.id}
      />
    </>
  );
}

function TemplateEditor({ open, onOpenChange, template, onSaved, userId }: { open: boolean; onOpenChange: (v: boolean) => void; template: MessageTemplate | null; onSaved: () => void; userId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cat, setCat] = useState<string>("general");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTitle(template?.title ?? "");
    setBody(template?.body ?? "");
    setCat(template?.category ?? "general");
  }, [template, open]);

  async function save() {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    setBusy(true);
    try {
      if (template) await updateTemplate(template.id, { title: title.trim(), body, category: cat });
      else await createTemplate({ title: title.trim(), body, category: cat }, userId);
      toast.success(template ? "Updated" : "Created");
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Variables like <code className="text-primary">{"{{name}}"}</code>, <code className="text-primary">{"{{company}}"}</code>, <code className="text-primary">{"{{first_name}}"}</code> get replaced when inserted into a lead chat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First-touch email" /></div>
            <div><Label>Category</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="font-mono text-sm" placeholder={"Hey {{first_name}},\n\nSaw {{company}} is scaling fast…"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}