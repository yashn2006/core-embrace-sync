import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Camera, Loader2, Shield, User as UserIcon, KeyRound, LogOut, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CoreEgin Sales OS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role, signOut } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.name ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setPhone((data as any)?.phone ?? "");
    });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ name: name.trim(), avatar_url: avatarUrl || null }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Image files only"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      const url = signed?.signedUrl ?? "";
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(url);
      toast.success("Avatar updated");
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  }

  async function removeAvatar() {
    if (!user) return;
    setBusy(true);
    try {
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      setAvatarUrl("");
      toast.success("Avatar removed");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function changePassword() {
    if (password.length < 8) { toast.error("Password must be ≥ 8 chars"); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Settings" description="Your profile and account." />
      <div className="p-6 md:p-8 max-w-3xl space-y-4">
        <section className="surface p-6 space-y-5 animate-reveal">
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5 text-primary" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Profile</div>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center text-white text-2xl font-semibold shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-magenta)" }}>
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (name || user?.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                aria-label="Change avatar"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.email}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-0.5">{role === "owner" ? "Founder / Owner" : "Sales Rep"}</div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Camera className="h-3.5 w-3.5 mr-1.5" />{uploading ? "Uploading…" : "Upload photo"}
                </Button>
                {avatarUrl && <Button size="sm" variant="ghost" onClick={removeAvatar}><Trash2 className="h-3.5 w-3.5 mr-1" />Remove</Button>}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">PNG or JPG, up to 2 MB.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" disabled />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={busy}>Save changes</Button>
          </div>
        </section>

        <section className="surface p-6 space-y-4 animate-reveal">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Change password</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={busy || !password}>Update password</Button>
          </div>
        </section>

        <section className="surface p-6 space-y-3 animate-reveal">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Account</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">Email</div><div className="font-medium">{user?.email}</div></div>
            <div><div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">Role</div><div className="font-medium">{role === "owner" ? "Founder / Owner" : "Sales Rep"}</div></div>
          </div>
          <div className="pt-2 border-t border-hairline/60 flex justify-end">
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3.5 w-3.5 mr-1.5" />Sign out</Button>
          </div>
        </section>
      </div>
    </>
  );
}