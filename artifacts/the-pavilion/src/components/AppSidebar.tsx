import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, Gavel, Calendar, Play, BarChart3, Award, Settings2, Home, Users, Swords, Layers, User, Crown, MessageSquare, History, Repeat, ScrollText, Trophy, GitBranch, Star } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const groups: { label: string; items: { title: string; url: string; icon: any }[] }[] = [
  {
    label: "League",
    items: [
      { title: "Dashboard", url: "/", icon: Home },
      { title: "Retention", url: "/retention", icon: Repeat },
      { title: "Auction",   url: "/auction",  icon: Gavel },
      { title: "Schedule",  url: "/schedule", icon: Calendar },
      { title: "Match",     url: "/match",    icon: Play },
      { title: "Scorecards",url: "/scorecard",icon: ScrollText },
      { title: "Ceremony",  url: "/ceremony", icon: Trophy },
    ],
  },
  {
    label: "Teams",
    items: [
      { title: "Squads",      url: "/squads", icon: Users },
      { title: "Squad Depth", url: "/depth",  icon: Layers },
      { title: "Head-to-Head",url: "/h2h",    icon: Swords },
    ],
  },
  {
    label: "Stats",
    items: [
      { title: "Players",     url: "/players",  icon: User },
      { title: "Live Stats",  url: "/stats",    icon: BarChart3 },
      { title: "Records",     url: "/records",  icon: Award },
      { title: "Season History", url: "/history", icon: History },
      { title: "All-Time",    url: "/all-time", icon: Crown },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Social",     url: "/social",     icon: MessageSquare },
      { title: "Multiverse", url: "/multiverse", icon: GitBranch },
      { title: "Chairman",   url: "/chairman",   icon: Settings2 },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (p: string) => p === "/" ? pathname === "/" : pathname.startsWith(p);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-sm bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="leading-none">
              <div className="font-serif text-xl text-foreground">The&nbsp;Pavilion</div>
              <div className="kicker mt-1">Quarterly</div>
            </div>
          )}
        </div>

        {groups.map(g => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
