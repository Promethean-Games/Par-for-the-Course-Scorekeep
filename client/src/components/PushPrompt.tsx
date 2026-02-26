import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { isPushSupported, subscribeToPush, getPermissionState } from "@/lib/pushNotifications";

const PROMPT_DISMISSED_KEY = "pushPromptDismissed";

export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (localStorage.getItem(PROMPT_DISMISSED_KEY)) return;

      const supported = await isPushSupported();
      if (!supported) return;

      const permission = await getPermissionState();
      if (permission === "granted" || permission === "denied") {
        localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
        return;
      }

      setVisible(true);
    };
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    setSubscribing(true);
    const deviceId = localStorage.getItem("deviceId") || undefined;
    const success = await subscribeToPush({ deviceId });
    localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
    setSubscribing(false);
    setVisible(false);
    if (!success) {
      console.log("Push subscription was not granted");
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-center text-center px-8 max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Bell className="w-10 h-10 text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold mb-3" data-testid="text-push-title">
          Stay in the Loop
        </h2>
        
        <p className="text-muted-foreground text-base leading-relaxed mb-8" data-testid="text-push-description">
          Get notified about leaderboard updates, tee times, and tournament results. 
          No spam — just the good stuff.
        </p>

        <div className="w-full space-y-3">
          <Button
            className="w-full h-14 text-lg font-semibold"
            onClick={handleAllow}
            disabled={subscribing}
            data-testid="button-push-allow"
          >
            {subscribing ? "Setting up..." : "Turn On Notifications"}
          </Button>
          <Button
            variant="ghost"
            className="w-full h-12 text-base text-muted-foreground"
            onClick={handleDismiss}
            data-testid="button-push-dismiss"
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
}
