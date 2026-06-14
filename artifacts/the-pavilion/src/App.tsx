import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/lib/auth";
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
import Multiverse from "./pages/Multiverse";
import HallOfFame from "./pages/HallOfFame";
import AuthPage from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AwardsVoting from "./pages/AwardsVoting";
import ImageStudio from "./pages/ImageStudio";
import Rivalries from "./pages/Rivalries";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="light" position="top-right" />
      <BrowserRouter basename={basePath}>
        <AuthProvider>
          <Routes>
            <Route path="/signin" element={<AuthPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/auction" element={<Auction />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/match" element={<Match />} />
              <Route path="/scorecard" element={<Scorecard />} />
              <Route path="/squads" element={<Squads />} />
              <Route path="/depth" element={<SquadDepth />} />
              <Route path="/h2h" element={<HeadToHead />} />
              <Route path="/rivalries" element={<Rivalries />} />
              <Route path="/players" element={<PlayerProfile />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/records" element={<Records />} />
              <Route path="/all-time" element={<AllTime />} />
              <Route path="/hall-of-fame" element={<HallOfFame />} />
              <Route path="/history" element={<SeasonHistory />} />
              <Route path="/retention" element={<Retention />} />
              <Route path="/social" element={<Social />} />
              <Route path="/social/:handle" element={<SocialProfile />} />
              <Route path="/ceremony" element={<Ceremony />} />
              <Route path="/awards" element={<AwardsVoting />} />
              <Route path="/chairman" element={<Chairman />} />
              <Route path="/multiverse" element={<Multiverse />} />
              <Route path="/studio" element={<ImageStudio />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
