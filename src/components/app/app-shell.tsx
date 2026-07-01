import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, KanbanSquare, MessageSquare, UserCog, LogOut, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/chat", label: "Chat", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initials = (user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-hairline bg-sidebar">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-hairline">
          <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">C</span>
          </div>
          <div className="text-sm font-semibold tracking-tight">CoreEgin</div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm " +
                  (active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}

          {role === "owner" && (
            <Link
              to="/team"
              className={
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm " +
                (pathname.startsWith("/team")
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground")
              }
            >
              <UserCog className="h-4 w-4" />
              <span>Team</span>
            </Link>
          )}
        </nav>

        <div className="border-t border-hairline p-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
            <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{user?.email}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {role === "owner" ? "Founder" : "Sales Rep"}
              </div>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-hairline flex items-center gap-3 px-4 md:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">C</span>
            </div>
            <div className="text-sm font-semibold">CoreEgin</div>
          </div>
          <div className="hidden md:flex items-center gap-2 max-w-sm w-full text-muted-foreground text-sm px-2.5 py-1.5 rounded-md bg-muted/40 border border-hairline">
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search leads, people…</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-hairline font-mono">⌘K</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={signOut} className="md:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>

        <nav className="md:hidden border-t border-hairline grid grid-cols-4 bg-sidebar">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] " +
                  (active ? "text-primary" : "text-muted-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}