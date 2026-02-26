import { useState } from "react";
import { BottomNav } from "../BottomNav";

export default function BottomNavExample() {
  const [activeTab, setActiveTab] = useState<"game" | "summary" | "settings" | "save">("game");

  return (
    <div className="h-screen relative">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-2">Bottom Navigation</h2>
        <p className="text-muted-foreground">Active: {activeTab}</p>
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
