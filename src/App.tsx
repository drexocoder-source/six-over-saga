import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Auction from "./pages/Auction";
import Schedule from "./pages/Schedule";
import Match from "./pages/Match";
import Stats from "./pages/Stats";
import Records from "./pages/Records";
import Squads from "./pages/Squads";
import Chairman from "./pages/Chairman";
import HeadToHead from "./pages/HeadToHead";
import SquadDepth from "./pages/SquadDepth";
import PlayerProfile from "./pages/PlayerProfile";
import AllTime from "./pages/AllTime";
import Social from "./pages/Social";
import SocialProfile from "./pages/SocialProfile";
import SeasonHistory from "./pages/SeasonHistory";
import Retention from "./pages/Retention";
import Scorecard from "./pages/Scorecard";
import Ceremony from "./pages/Ceremony";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="light" position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auction" element={<Auction />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/match" element={<Match />} />
            <Route path="/scorecard" element={<Scorecard />} />
            <Route path="/squads" element={<Squads />} />
            <Route path="/depth" element={<SquadDepth />} />
            <Route path="/h2h" element={<HeadToHead />} />
            <Route path="/players" element={<PlayerProfile />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/records" element={<Records />} />
            <Route path="/all-time" element={<AllTime />} />
            <Route path="/history" element={<SeasonHistory />} />
            <Route path="/retention" element={<Retention />} />
            <Route path="/social" element={<Social />} />
            <Route path="/social/:handle" element={<SocialProfile />} />
            <Route path="/ceremony" element={<Ceremony />} />
            <Route path="/chairman" element={<Chairman />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
