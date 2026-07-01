import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ORG_ID, SOURCES, type SourceKey } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import type { Profile } from "@/lib/leads";
import { toast } from "sonner";
import { Upload, FileSpreadsheet } from "lucide-react";

const LEAD_FIELDS = [
  { key: "name", label: "Name *", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "description", label: "Description" },
  { key: "deal_value", label: "Deal value" },
] as const;

type FieldKey = (typeof LEAD_FIELDS)[number]["key"];

function guessMapping(headers: string[]): Record<FieldKey, string> {
  const map: Partial<Record<FieldKey, string>> = {};
  for (const h of headers) {
    const n = h.toLowerCase().trim();
    if (!map.name && /(^| )(name|full.?name|contact)($| )/.test(n)) map.name = h;
    else if (!map.email && n.includes("email")) map.email = h;
    else if (!map.phone && /(phone|mobile|whatsapp)/.test(n)) map.phone = h;
    else if (!map.company && /(company|org|business)/.test(n)) map.company = h;
    else if (!map.description && /(desc|notes?|details?)/.test(n)) map.description = h;
    else if (!map.deal_value && /(value|amount|budget|deal)/.test(n)) map.deal_value = h;
  }
  return map as Record<FieldKey, string>;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  profiles,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: Profile[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as any);
  const [source, setSource] = useState<SourceKey>("cold_outreach");
  const [assignTo, setAssignTo] = useState<string>("__unassigned__");
  const [importing, setImporting] = useState(false);

  function reset() {
    setRows([]); setHeaders([]); setFilename(""); setMapping({} as any); setAssignTo("__unassigned__");
  }

  function handleFile(f: File) {
    setFilename(f.name);
    Papa.parse<Record<string, string>>(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const heads = res.meta.fields ?? [];
        setHeaders(heads);
        setRows(res.data);
        setMapping(guessMapping(heads));
      },
      error: (e) => toast.error(e.message),
    });
  }

  const preview = useMemo(() => rows.slice(0, 3), [rows]);

  async function runImport() {
    if (!user) return;
    if (!mapping.name) { toast.error("Map the Name column"); return; }
    if (rows.length === 0) { toast.error("No rows to import"); return; }
    setImporting(true);
    try {
      const finalAssignee = assignTo === "__unassigned__" ? user.id : assignTo;
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({ org_id: DEFAULT_ORG_ID, uploaded_by: user.id, assigned_to: finalAssignee, filename, row_count: rows.length })
        .select("*").single();
      if (batchErr) throw batchErr;

      const payload = rows.map((r) => {
        const dv = mapping.deal_value ? Number(String(r[mapping.deal_value]).replace(/[^0-9.]/g, "")) : null;
        return {
          org_id: DEFAULT_ORG_ID,
          name: (r[mapping.name] ?? "").toString().trim() || "Unnamed",
          email: mapping.email ? r[mapping.email]?.toString().trim() || null : null,
          phone: mapping.phone ? r[mapping.phone]?.toString().trim() || null : null,
          company: mapping.company ? r[mapping.company]?.toString().trim() || null : null,
          description: mapping.description ? r[mapping.description]?.toString().trim() || null : null,
          deal_value: dv && !Number.isNaN(dv) ? dv : null,
          source,
          stage: "new" as const,
          assigned_to: finalAssignee,
          created_by: user.id,
          import_batch_id: batch.id,
        };
      });

      // Insert in chunks of 100
      for (let i = 0; i < payload.length; i += 100) {
        const { error } = await supabase.from("leads").insert(payload.slice(i, i + 100));
        if (error) throw error;
      }
      toast.success(`Imported ${payload.length} leads`);
      reset();
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" /> Import leads from CSV</DialogTitle>
          <DialogDescription>Map your columns, assign the batch to a rep, and import.</DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <label className="block border-2 border-dashed border-hairline rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[.02] transition-colors">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">Drop CSV or click to upload</div>
            <div className="text-xs text-muted-foreground mt-1">First row must be column headers</div>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              <b className="text-foreground">{filename}</b> · {rows.length} rows · {headers.length} columns
            </div>

            <div className="grid grid-cols-2 gap-3">
              {LEAD_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Select
                    value={mapping[f.key] ?? "__none__"}
                    onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="— skip —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Assign entire batch to</Label>
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Me (owner)</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Source tag</Label>
                <Select value={source} onValueChange={(v) => setSource(v as SourceKey)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {preview.length > 0 && mapping.name && (
              <div className="surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview (first 3 rows)</div>
                <div className="space-y-1 text-sm">
                  {preview.map((r, i) => (
                    <div key={i} className="flex gap-2 truncate">
                      <span className="font-medium">{r[mapping.name]}</span>
                      <span className="text-muted-foreground truncate">
                        {mapping.company && r[mapping.company]}
                        {mapping.email && ` · ${r[mapping.email]}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && <Button variant="ghost" onClick={reset}>Choose another file</Button>}
          <Button onClick={runImport} disabled={importing || rows.length === 0 || !mapping.name}>
            {importing ? "Importing…" : `Import ${rows.length || ""} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}