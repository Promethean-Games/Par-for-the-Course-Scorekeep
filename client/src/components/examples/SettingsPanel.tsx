import { useState } from "react";
import { SettingsPanel } from "../SettingsPanel";
import type { Settings } from "@shared/schema";

export default function SettingsPanelExample() {
  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    leftHandedMode: false,
    autoSave: true,
  });

  return (
    <SettingsPanel
      settings={settings}
      onUpdateSettings={(updates) => setSettings({ ...settings, ...updates })}
      onClose={() => console.log("Close")}
      onEndGame={() => console.log("End game")}
    />
  );
}
