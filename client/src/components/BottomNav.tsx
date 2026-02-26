import { Button } from "@/components/ui/button";
import { Home, Trophy, Settings as SettingsIcon, Save, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: "game" | "summary" | "settings" | "save";
  onTabChange: (tab: "game" | "summary" | "settings" | "save") => void;
  viewOnly?: boolean;
  isTournament?: boolean;
  onGoHome?: () => void;
}

export function BottomNav({ activeTab, onTabChange, viewOnly, isTournament, onGoHome }: BottomNavProps) {
  const allTabs = [
    { id: "game" as const, icon: Home, label: "Game" },
    { id: "summary" as const, icon: Trophy, label: "Leaderboard" },
    { id: "save" as const, icon: Save, label: "Save" },
    { id: "settings" as const, icon: SettingsIcon, label: "Settings" },
  ];

  let tabs = allTabs;
  if (viewOnly) {
    tabs = allTabs.filter(t => t.id === "summary" || t.id === "settings");
  } else if (isTournament) {
    tabs = allTabs.filter(t => t.id !== "save");
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center z-40">
      {viewOnly && onGoHome && (
        <Button
          variant="ghost"
          className="h-full rounded-none flex flex-col gap-1 items-center justify-center px-4"
          onClick={onGoHome}
          data-testid="nav-home"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs">Exit</span>
        </Button>
      )}
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <Button
            key={tab.id}
            variant="ghost"
            className={cn(
              "flex-1 h-full rounded-none flex flex-col gap-1 items-center justify-center",
              isActive && "bg-primary/10"
            )}
            onClick={() => onTabChange(tab.id)}
            data-testid={`nav-${tab.id}`}
          >
            <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
            <span className={cn("text-xs", isActive && "text-primary font-semibold")}>
              {tab.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
