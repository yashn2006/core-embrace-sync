import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CoreEgin Sales OS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.name ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
    });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ name, avatar_url: avatarUrl || null }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function changePassword() {
    if (password.length < 8) { toast.error("Password must be ≥ 8 chars"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast.success("Password updated");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile and account." />
      <div className="p-6 md:p-8 max-w-2xl space-y-6">
        <section className="surface p-5 space-y-4">
          <div>
            <div className="text-sm font-medium">Profile</div>
            <div className="text-xs text-muted-foreground">This is what your team sees.</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-semibold" style={{ background: "var(--gradient-magenta)" }}>
              {(name || user?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium">{user?.email}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{role === "owner" ? "Founder" : "Sales Rep"}</div>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Avatar URL (optional)</Label><Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" /></div>
          <Button onClick={saveProfile} disabled={busy}>Save profile</Button>
        </section>

        <section className="surface p-5 space-y-4">
          <div>
            <div className="text-sm font-medium">Change password</div>
            <div className="text-xs text-muted-foreground">Min 8 characters.</div>
          </div>
          <div className="space-y-1.5"><Label className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button onClick={changePassword} disabled={busy}>Update password</Button>
        </section>
      </div>
    </>
  );
}