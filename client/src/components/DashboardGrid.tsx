import { useState, useEffect, useRef, useCallback } from "react";
import { Responsive } from "react-grid-layout";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

type Layouts = ResponsiveLayouts<string>;
type LayoutEntry = LayoutItem & { minW?: number; minH?: number; maxW?: number; maxH?: number };

const DASHBOARD_DEFAULT_LAYOUTS: Layouts = {
  lg: [
    { i: "status",      x: 0,  y: 0,  w: 4,  h: 4,  minW: 3, minH: 3 },
    { i: "controls",    x: 4,  y: 0,  w: 4,  h: 4,  minW: 3, minH: 3 },
    { i: "stats",       x: 8,  y: 0,  w: 4,  h: 4,  minW: 3, minH: 3 },
    { i: "leaderboard", x: 0,  y: 4,  w: 6,  h: 7,  minW: 3, minH: 4 },
    { i: "groups",      x: 6,  y: 4,  w: 6,  h: 7,  minW: 3, minH: 4 },
    { i: "addplayer",   x: 0,  y: 11, w: 6,  h: 7,  minW: 4, minH: 5 },
    { i: "players",     x: 6,  y: 11, w: 6,  h: 7,  minW: 4, minH: 5 },
    { i: "payout",      x: 0,  y: 18, w: 12, h: 10, minW: 6, minH: 7 },
  ],
  md: [
    { i: "status",      x: 0,  y: 0,  w: 5,  h: 4,  minW: 3, minH: 3 },
    { i: "controls",    x: 5,  y: 0,  w: 5,  h: 4,  minW: 3, minH: 3 },
    { i: "stats",       x: 0,  y: 4,  w: 10, h: 3,  minW: 4, minH: 2 },
    { i: "leaderboard", x: 0,  y: 7,  w: 5,  h: 7,  minW: 3, minH: 4 },
    { i: "groups",      x: 5,  y: 7,  w: 5,  h: 7,  minW: 3, minH: 4 },
    { i: "addplayer",   x: 0,  y: 14, w: 5,  h: 7,  minW: 3, minH: 5 },
    { i: "players",     x: 5,  y: 14, w: 5,  h: 7,  minW: 3, minH: 5 },
    { i: "payout",      x: 0,  y: 21, w: 10, h: 10, minW: 5, minH: 7 },
  ],
  sm: [
    { i: "status",      x: 0,  y: 0,  w: 3,  h: 4,  minW: 2, minH: 3 },
    { i: "controls",    x: 3,  y: 0,  w: 3,  h: 4,  minW: 2, minH: 3 },
    { i: "stats",       x: 0,  y: 4,  w: 6,  h: 3,  minW: 3, minH: 2 },
    { i: "leaderboard", x: 0,  y: 7,  w: 3,  h: 7,  minW: 2, minH: 4 },
    { i: "groups",      x: 3,  y: 7,  w: 3,  h: 7,  minW: 2, minH: 4 },
    { i: "addplayer",   x: 0,  y: 14, w: 6,  h: 7,  minW: 3, minH: 5 },
    { i: "players",     x: 0,  y: 21, w: 6,  h: 7,  minW: 3, minH: 5 },
    { i: "payout",      x: 0,  y: 28, w: 6,  h: 10, minW: 4, minH: 7 },
  ],
  xs: [
    { i: "status",      x: 0,  y: 0,  w: 4,  h: 4,  minW: 2, minH: 3 },
    { i: "controls",    x: 0,  y: 4,  w: 4,  h: 4,  minW: 2, minH: 3 },
    { i: "stats",       x: 0,  y: 8,  w: 4,  h: 3,  minW: 2, minH: 2 },
    { i: "leaderboard", x: 0,  y: 11, w: 4,  h: 7,  minW: 2, minH: 4 },
    { i: "groups",      x: 0,  y: 18, w: 4,  h: 7,  minW: 2, minH: 4 },
    { i: "addplayer",   x: 0,  y: 25, w: 4,  h: 7,  minW: 2, minH: 5 },
    { i: "players",     x: 0,  y: 32, w: 4,  h: 7,  minW: 2, minH: 5 },
    { i: "payout",      x: 0,  y: 39, w: 4,  h: 10, minW: 3, minH: 7 },
  ],
};

interface DashboardGridProps {
  children: React.ReactNode;
  storageKey: string;
}

export function DashboardGrid({ children, storageKey }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // null means "not yet measured" — grid won't render until we have the real width
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const [layouts, setLayouts] = useState<Layouts>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : DASHBOARD_DEFAULT_LAYOUTS;
    } catch {
      return DASHBOARD_DEFAULT_LAYOUTS;
    }
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    // Synchronous first measurement — avoids the wrong-breakpoint first paint
    const w = el.getBoundingClientRect().width;
    if (w > 0) setContainerWidth(w);
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: Layouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(storageKey, JSON.stringify(allLayouts));
  }, [storageKey]);

  const handleReset = () => {
    setLayouts(DASHBOARD_DEFAULT_LAYOUTS);
    localStorage.removeItem(storageKey);
  };

  return (
    <div>
      <div className="flex justify-end mb-1 px-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-6 text-xs gap-1 opacity-40 hover:opacity-80"
          data-testid="button-reset-layout"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Layout
        </Button>
      </div>
      <div ref={containerRef} style={{ position: "relative" }}>
        {containerWidth !== null ? (
          <Responsive
            width={containerWidth}
            layouts={layouts}
            onLayoutChange={handleLayoutChange}
            breakpoints={{ lg: 992, md: 768, sm: 480, xs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={34}
            margin={[6, 6]}
            containerPadding={[0, 0]}
            dragConfig={{ enabled: true, handle: ".drag-handle" } as any}
            resizeConfig={{ enabled: true, handles: ["se"] } as any}
          >
            {children}
          </Responsive>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading dashboard...
          </div>
        )}
      </div>
    </div>
  );
}
