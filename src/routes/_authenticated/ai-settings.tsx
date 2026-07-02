import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Key, Zap, ShieldCheck, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getAiSettings, saveAiSettings, testAiSettings, resetAiSettings } from "@/lib/ai-settings.functions";

export const Route = createFileRoute("/_authenticated/ai-settings")({
  head: () => ({ meta: [{ title: "AI Settings — CoreEgin Sales OS" }] }),
  component: AiSettingsPage,
});

type Provider = "lovable" | "openai" | "gemini";

const PROVIDER_INFO: Record<Provider, { name: string; help: string; keyLabel: string; keyPlaceholder: string; modelPlaceholder: string; docs: string }> = {
  lovable: {
    name: "Lovable AI (default)",
    help: "Uses Lovable's built-in AI gateway. No key required — billed as Lovable credits.",
    keyLabel: "",
    keyPlaceholder: "",
    modelPlaceholder: "google/gemini-3-flash-preview",
    docs: "",
  },
  openai: {
    name: "OpenAI (your key)",
    help: "Bring your own OpenAI API key. Billed by OpenAI directly.",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-…",
    modelPlaceholder: "gpt-4o-mini",
    docs: "https://platform.openai.com/api-keys",
  },
  gemini: {
    name: "Google Gemini (your key)",
    help: "Bring your own Google AI Studio API key. Billed by Google directly.",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza…",
    modelPlaceholder: "gemini-2.0-flash",
    docs: "https://aistudio.google.com/app/apikey",
  },
};

function AiSettingsPage() {
  const { role } = useAuth();
  const get = useServerFn(getAiSettings);
  const save = useServerFn(saveAiSettings);
  const test = useServerFn(testAiSettings);
  const reset = useServerFn(resetAiSettings);

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider>("lovable");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; ms?: number } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const s = await get();
      setProvider(s.provider);
      setModel(s.model ?? "");
      setHasKey(s.hasKey);
      setKeyPreview(s.keyPreview);
      setUpdatedAt(s.updated_at);
      setApiKey("");
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  if (role && role !== "owner") {
    return (
      <>
        <PageHeader title="AI Settings" description="Owner-only." />
        <div className="p-8"><div className="surface p-8 text-center text-sm text-muted-foreground">This area is for owners only.</div></div>
      </>
    );
  }

  const info = PROVIDER_INFO[provider];

  async function onSave() {
    setBusy("save");
    try {
      await save({ data: { provider, api_key: apiKey || undefined, model: model || undefined } });
      toast.success("AI settings saved — used by Coach, Digest, and Lead Assist");
      setTestResult(null);
      await refresh();
    } catch (e: any) { toast.error(e.message); }
    setBusy("");
  }

  async function onTest() {
    setBusy("test");
    setTestResult(null);
    try {
      const r = await test();
      setTestResult({ ok: true, msg: `${r.provider} · ${r.model} · ${r.sample}`, ms: r.latencyMs });
      toast.success(`AI reachable in ${r.latencyMs}ms`);
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message ?? String(e) });
      toast.error(e.message ?? "Test failed");
    }
    setBusy("");
  }

  async function onReset() {
    if (!confirm("Reset to Lovable AI? Any stored OpenAI/Gemini key will be removed.")) return;
    setBusy("reset");
    try { await reset(); toast.success("Reset to Lovable AI"); await refresh(); }
    catch (e: any) { toast.error(e.message); }
    setBusy("");
  }

  return (
    <>
      <PageHeader
        title="AI Settings"
        description="Choose which AI powers Coach, Weekly Digest, and Lead Assist for everyone."
      />
      <div className="p-6 md:p-8 max-w-3xl space-y-4">
        {loading ? (
          <div className="surface p-8 text-sm text-muted-foreground text-center">Loading…</div>
        ) : (
          <>
            <div className="surface p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "var(--gradient-magenta)" }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Provider</div>
                  <div className="text-xs text-muted-foreground">{info.help}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider">AI Provider</Label>
                  <Select value={provider} onValueChange={(v) => { setProvider(v as Provider); setModel(""); setTestResult(null); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lovable">Lovable AI (default)</SelectItem>
                      <SelectItem value="openai">OpenAI (your key)</SelectItem>
                      <SelectItem value="gemini">Google Gemini (your key)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider">Model</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={info.modelPlaceholder} className="h-9" />
                  <div className="text-[10px] text-muted-foreground mt-1">Leave blank to use <span className="tabular">{info.modelPlaceholder}</span>.</div>
                </div>
              </div>

              {provider !== "lovable" && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"><Key className="h-3 w-3" />{info.keyLabel}</Label>
                  <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={hasKey ? `Saved: ${keyPreview} — leave blank to keep` : info.keyPlaceholder} className="h-9 font-mono text-xs" />
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-success" />
                    Encrypted at rest. Only owners can view or change it. Reps never see the key.
                    {info.docs && (
                      <>· <a className="text-primary hover:underline" href={info.docs} target="_blank" rel="noreferrer">Get a key</a></>
                    )}
                  </div>
                </div>
              )}

              {updatedAt && (
                <div className="text-[10px] text-muted-foreground">Last updated: {new Date(updatedAt).toLocaleString()}</div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
                <Button onClick={onSave} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save settings"}</Button>
                <Button variant="outline" onClick={onTest} disabled={!!busy}>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />{busy === "test" ? "Testing…" : "Test connection"}
                </Button>
                <Button variant="ghost" onClick={onReset} disabled={!!busy} className="ml-auto text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset to Lovable AI
                </Button>
              </div>

              {testResult && (
                <div className={"text-xs p-3 rounded-lg border flex items-start gap-2 " + (testResult.ok ? "bg-success/10 border-success/30 text-success" : "bg-destructive/10 border-destructive/30 text-destructive")}>
                  {testResult.ok && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                  <div className="min-w-0"><div className="font-semibold">{testResult.ok ? `Working (${testResult.ms}ms)` : "Failed"}</div><div className="opacity-80 break-words">{testResult.msg}</div></div>
                </div>
              )}
            </div>

            <div className="surface p-5 space-y-2">
              <div className="text-sm font-semibold">How it works</div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li><b>Lovable AI</b> — default. Uses the built-in gateway; no key required.</li>
                <li><b>OpenAI</b> — provide your <code>sk-…</code> key. Every AI feature routes through OpenAI's API.</li>
                <li><b>Gemini</b> — provide your Google AI Studio key. Every AI feature routes through Gemini.</li>
                <li>Changes apply instantly to <b>everyone</b> — reps and owners — for AI Coach, Weekly Digest, and Lead Assist.</li>
                <li>If your key stops working, the system will show the provider's error. Click <b>Reset to Lovable AI</b> as a safety fallback.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}