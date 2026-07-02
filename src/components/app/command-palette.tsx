import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessageSquare,
  Video,
  Wallet,
  Settings,
  UserCog,
  Plus,
  Upload,
  Inbox,
  LogOut,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type LeadHit = { id: string; name: string; company: string | null; stage: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const navigate = useNavigate();
  const { role, signOut } = useAuth();
  const isOwner = role === "owner";

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Search leads (debounced)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, company, stage")
        .or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8);
      setHits((data as LeadHit[] | null) ?? []);
    }, 140);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search leads, jump to a page, run an action…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {hits.length > 0 && (
          <CommandGroup heading="Leads">
            {hits.map((h) => (
              <CommandItem key={h.id} value={`lead-${h.id}-${h.name}`} onSelect={() => go(`/leads?q=${encodeURIComponent(h.name)}`)}>
                <Search className="h-4 w-4" />
                <span className="truncate">{h.name}</span>
                {h.company && <span className="text-muted-foreground text-xs truncate">· {h.company}</span>}
                <CommandShortcut>{h.stage}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Jump to">
          <CommandItem onSelect={() => go("/dashboard")}><LayoutDashboard className="h-4 w-4" />Dashboard<CommandShortcut>G D</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/inbox")}><Inbox className="h-4 w-4" />Smart follow-up inbox<CommandShortcut>G I</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/leads")}><Users className="h-4 w-4" />Leads<CommandShortcut>G L</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/pipeline")}><KanbanSquare className="h-4 w-4" />Pipeline<CommandShortcut>G P</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/meetings")}><Video className="h-4 w-4" />Meetings<CommandShortcut>G M</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/chat")}><MessageSquare className="h-4 w-4" />Chat<CommandShortcut>G C</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go("/earnings")}><Wallet className="h-4 w-4" />Earnings</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/leads?new=1")}><Plus className="h-4 w-4" />New lead</CommandItem>
          {isOwner && <CommandItem onSelect={() => go("/leads?import=1")}><Upload className="h-4 w-4" />Import CSV / Excel</CommandItem>}
          {isOwner && <CommandItem onSelect={() => go("/team")}><UserCog className="h-4 w-4" />Manage team</CommandItem>}
          <CommandItem onSelect={() => go("/settings")}><Settings className="h-4 w-4" />Settings</CommandItem>
          <CommandItem onSelect={() => { setOpen(false); void signOut(); }}><LogOut className="h-4 w-4" />Sign out</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}