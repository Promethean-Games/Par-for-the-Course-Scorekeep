import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Trophy, Users, Settings, Palette, ChevronDown, ChevronUp } from "lucide-react";
import { TournamentManagementTab } from "./TournamentManagementTab";
import { PlayerDirectoryTab } from "./PlayerDirectoryTab";
import { PayoutCalculator } from "./PayoutCalculator";
import { Card } from "@/components/ui/card";

interface TDDashboardProps {
  onClose: () => void;
  directorPin: string;
}

type DirectorTheme = "default" | "dark-green" | "dark-blue" | "light";

export function TDDashboard({ onClose, directorPin }: TDDashboardProps) {
  const [activeTab, setActiveTab] = useState<"tournaments" | "players" | "settings">("tournaments");
  const [directorTheme, setDirectorTheme] = useState<DirectorTheme>(() => {
    const saved = localStorage.getItem("directorTheme");
    return (saved as DirectorTheme) || "default";
  });
  const [tournamentOptions, setTournamentOptions] = useState<{ id: number; roomCode: string; name: string }[]>([]);
  const [themeExpanded, setThemeExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/tournaments?directorPin=${encodeURIComponent(directorPin)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTournamentOptions(data.map((t: any) => ({ id: t.id, roomCode: t.roomCode, name: t.name })));
        }
      })
      .catch(() => {});
  }, [directorPin]);

  const handleThemeChange = (theme: DirectorTheme) => {
    setDirectorTheme(theme);
    localStorage.setItem("directorTheme", theme);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="td-dashboard">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="text-primary-foreground"
          data-testid="button-back"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Tournament Director Dashboard</h1>
      </header>

      <Tabs 
        value={activeTab} 
        onValueChange={(v) => setActiveTab(v as "tournaments" | "players" | "settings")}
        className="flex-1 flex flex-col"
      >
        <TabsList className="w-full h-auto rounded-none border-b bg-background p-0">
          <TabsTrigger 
            value="tournaments"
            className="flex-1 flex items-center gap-2 py-4 data-[state=active]:bg-muted rounded-none"
            data-testid="tab-tournaments"
          >
            <Trophy className="h-5 w-5" />
            Tournaments
          </TabsTrigger>
          <TabsTrigger 
            value="players"
            className="flex-1 flex items-center gap-2 py-4 data-[state=active]:bg-muted rounded-none"
            data-testid="tab-players"
          >
            <Users className="h-5 w-5" />
            Players
          </TabsTrigger>
          <TabsTrigger 
            value="settings"
            className="flex-1 flex items-center gap-2 py-4 data-[state=active]:bg-muted rounded-none"
            data-testid="tab-settings"
          >
            <Settings className="h-5 w-5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments" className="flex-1 m-0 p-0 overflow-auto">
          <TournamentManagementTab directorPin={directorPin} />
        </TabsContent>

        <TabsContent value="players" className="flex-1 m-0 p-0 overflow-auto">
          <PlayerDirectoryTab directorPin={directorPin} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 p-0 overflow-auto">
          <div className="p-4 space-y-4">
            <PayoutCalculator
              directorPin={directorPin}
              tournaments={tournamentOptions}
            />

            <Card className="p-4">
              <button
                className="w-full flex items-center gap-2 font-semibold"
                onClick={() => setThemeExpanded(!themeExpanded)}
                data-testid="button-toggle-theme"
              >
                <Palette className="w-4 h-4" />
                <span className="flex-1 text-left">Director Portal Theme</span>
                {themeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {themeExpanded && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    className={`p-4 rounded-lg border-2 transition-all ${
                      directorTheme === "default" 
                        ? "border-green-500 bg-green-500/10" 
                        : "border-transparent hover:border-gray-300"
                    }`}
                    onClick={() => handleThemeChange("default")}
                    data-testid="theme-default"
                  >
                    <div className="w-full h-8 rounded bg-gradient-to-r from-gray-800 to-gray-600 mb-2" />
                    <p className="text-sm font-medium">PftC Default</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 transition-all ${
                      directorTheme === "dark-green" 
                        ? "border-green-500 bg-green-500/10" 
                        : "border-transparent hover:border-gray-300"
                    }`}
                    onClick={() => handleThemeChange("dark-green")}
                    data-testid="theme-dark-green"
                  >
                    <div className="w-full h-8 rounded bg-gradient-to-r from-emerald-900 to-emerald-700 mb-2" />
                    <p className="text-sm font-medium">Dark Green</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 transition-all ${
                      directorTheme === "dark-blue" 
                        ? "border-green-500 bg-green-500/10" 
                        : "border-transparent hover:border-gray-300"
                    }`}
                    onClick={() => handleThemeChange("dark-blue")}
                    data-testid="theme-dark-blue"
                  >
                    <div className="w-full h-8 rounded bg-gradient-to-r from-slate-900 to-slate-700 mb-2" />
                    <p className="text-sm font-medium">Dark Blue</p>
                  </button>
                  <button
                    className={`p-4 rounded-lg border-2 transition-all ${
                      directorTheme === "light" 
                        ? "border-green-500 bg-green-500/10" 
                        : "border-transparent hover:border-gray-300"
                    }`}
                    onClick={() => handleThemeChange("light")}
                    data-testid="theme-light"
                  >
                    <div className="w-full h-8 rounded bg-gradient-to-r from-gray-100 to-gray-300 mb-2" />
                    <p className="text-sm font-medium">Light</p>
                  </button>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
