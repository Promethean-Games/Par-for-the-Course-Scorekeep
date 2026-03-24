import { useState } from "react";
import { SettingsPanel } from "../SettingsPanel";
import type { Settings, Player } from "@shared/schema";

export default function SettingsPanelExample() {
  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    leftHandedMode: false,
    autoSave: true,
  });
  const [players] = useState<Player[]>([]);

  return (
    <SettingsPanel
      settings={settings}
      players={players}
      onUpdateSettings={(updates) => setSettings({ ...settings, ...updates })}
      onAddPlayer={(name) => console.log("Add player:", name)}
      onEndGame={() => console.log("End game")}
    />
  );
}
