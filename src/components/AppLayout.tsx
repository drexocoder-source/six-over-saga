import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-border bg-card sticky top-0 z-30">
            {/* Masthead */}
            <div className="px-4 md:px-8 py-4 flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex-1 flex items-baseline gap-3 overflow-hidden">
                <div className="font-serif text-3xl md:text-4xl leading-none text-foreground tracking-tight">The&nbsp;Pavilion</div>
                <div className="hidden md:block kicker">A Cricket League Quarterly</div>
              </div>
              <div className="hidden md:flex items-baseline gap-2 text-xs text-muted-foreground">
                <span className="kicker">Vol. I</span>
                <span>·</span>
                <span>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            </div>
            <div className="rule mx-4 md:mx-8" />
            <div className="rule mx-4 md:mx-8 mt-[3px] opacity-50" />
          </header>
          <main className="flex-1 px-4 md:px-8 py-6 md:py-10 overflow-auto">
            <Outlet />
          </main>
          <footer className="border-t border-border px-4 md:px-8 py-4 text-[11px] text-muted-foreground flex items-center justify-between">
            <div>© The Pavilion · Edited &amp; printed in the cloud</div>
            <div className="kicker">Cricket, considered.</div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
