import { type ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, KanbanSquare, MessageSquare, UserCog, LogOut, Sparkles, Settings, Menu, MessagesSquare, Video, Wallet, DollarSign, Inbox, Command } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { Button } from "@/components/ui/button";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { useFollowupNotifications } from "@/hooks/use-followup-notifications";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/app/command-palette";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/meetings", label: "Meetings", icon: Video },
  { to: "/lead-logs", label: "Lead logs", icon: MessagesSquare },
  { to: "/chat", label: "Chat", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  useSessionTimeout({ hardMs: 60 * 60_000, idleMs: 10 * 60_000 });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initials = (user?.email ?? "?").slice(0, 1).toUpperCase();
  const { total: unread } = useChatUnread();
  const [mobileOpen, setMobileOpen] = useState(false);
  useFollowupNotifications();

  const navItems = (
    <>
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          const showBadge = item.to === "/chat" && unread > 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={
                "group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
                (active
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")
              }
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
              <Icon className={"h-4 w-4 transition-colors " + (active ? "text-primary" : "group-hover:text-foreground")} />
              <span>{item.label}</span>
              {showBadge && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white tabular animate-pulse-ring" style={{ background: "var(--gradient-magenta)" }}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}

        {/* Earnings — visible to everyone; reps see own, owner sees all */}
        <Link to="/earnings" onClick={() => setMobileOpen(false)}
          className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
            (pathname.startsWith("/earnings") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
          {pathname.startsWith("/earnings") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
          <Wallet className={"h-4 w-4 " + (pathname.startsWith("/earnings") ? "text-primary" : "")} />
          <span>{role === "owner" ? "Earnings" : "My earnings"}</span>
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ background: "var(--gradient-magenta)" }}>20%</span>
        </Link>

        {role === "owner" && (
          <>
            <div className="pt-4 pb-1.5 px-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Admin</div>
            <Link to="/payouts" onClick={() => setMobileOpen(false)}
              className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
                (pathname.startsWith("/payouts") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {pathname.startsWith("/payouts") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
              <DollarSign className={"h-4 w-4 " + (pathname.startsWith("/payouts") ? "text-primary" : "")} />
              <span>Payouts</span>
            </Link>
            <Link to="/team" onClick={() => setMobileOpen(false)}
              className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
                (pathname.startsWith("/team") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {pathname.startsWith("/team") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
              <UserCog className={"h-4 w-4 " + (pathname.startsWith("/team") ? "text-primary" : "")} />
              <span>Team</span>
            </Link>
            <Link to="/health" onClick={() => setMobileOpen(false)}
              className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
                (pathname.startsWith("/health") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {pathname.startsWith("/health") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
              <span className="h-4 w-4 flex items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /></span>
              <span>System Health</span>
            </Link>
            <Link to="/permissions" onClick={() => setMobileOpen(false)}
              className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
                (pathname.startsWith("/permissions") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {pathname.startsWith("/permissions") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
              <span className="h-4 w-4 flex items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-primary" /></span>
              <span>Permissions</span>
            </Link>
          </>
        )}

        <div className="pt-4 pb-1.5 px-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Account</div>
        <Link to="/settings" onClick={() => setMobileOpen(false)}
          className={"group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
            (pathname.startsWith("/settings") ? "bg-sidebar-accent text-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
          {pathname.startsWith("/settings") && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: "var(--gradient-magenta)" }} />}
          <Settings className={"h-4 w-4 " + (pathname.startsWith("/settings") ? "text-primary" : "")} />
          <span>Settings</span>
        </Link>
      </nav>

      <div className="m-3 rounded-xl border border-hairline bg-card/60 backdrop-blur p-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-magenta)" }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{user?.email}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1">
              {role === "owner" && <Sparkles className="h-2.5 w-2.5 text-primary" />}
              {role === "owner" ? "Founder" : "Sales Rep"}
            </div>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground relative">
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-aurora opacity-70" />
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-hairline bg-sidebar/80 backdrop-blur relative">
        <div className="h-16 flex items-center gap-2.5 px-5">
          <div className="relative h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-magenta)" }}>
            C
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary animate-pulse-ring" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">CoreEgin</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-[0.14em]">Sales OS</div>
          </div>
        </div>
        {navItems}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 shrink-0 border-b border-hairline/70 flex items-center gap-3 px-4 md:px-8 bg-background/70 backdrop-blur-md sticky top-0 z-10">
          <div className="md:hidden flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button aria-label="Open menu" className="relative h-9 w-9 rounded-lg border border-hairline flex items-center justify-center hover:bg-muted transition">
                  <Menu className="h-4 w-4" />
                  {unread > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse-ring" />}
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 flex flex-col">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="h-16 flex items-center gap-2.5 px-5 border-b border-hairline">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-magenta)" }}>C</div>
                  <div>
                    <div className="text-sm font-semibold tracking-tight">CoreEgin</div>
                    <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-[0.14em]">Sales OS</div>
                  </div>
                </div>
                {navItems}
              </SheetContent>
            </Sheet>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-bold ml-1" style={{ background: "var(--gradient-magenta)" }}>
              C
            </div>
            <div className="text-sm font-semibold">CoreEgin</div>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">
            {role === "owner" ? "Founder workspace" : "Your workspace"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-hairline text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              aria-label="Open command palette"
            >
              <Command className="h-3.5 w-3.5" />
              <span>Search or jump…</span>
              <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd>
            </button>
            <Button size="sm" variant="ghost" onClick={signOut} className="md:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto relative">{children}</main>

        <nav className="md:hidden border-t border-hairline grid grid-cols-5 bg-sidebar/95 backdrop-blur sticky bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
          {NAV.slice(0, 5).map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            const showBadge = item.to === "/chat" && unread > 0;
            return (
              <Link key={item.to} to={item.to}
                className={"flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] relative transition-colors " +
                  (active ? "text-primary font-medium" : "text-muted-foreground")}>
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-semibold flex items-center justify-center text-white tabular" style={{ background: "var(--gradient-magenta)" }}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <CommandPalette />
    </div>
  );
}