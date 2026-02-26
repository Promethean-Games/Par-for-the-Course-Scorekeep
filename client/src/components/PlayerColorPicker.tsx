import { PLAYER_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PlayerColorPickerProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

export function PlayerColorPicker({ selectedColor, onColorSelect }: PlayerColorPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PLAYER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          data-testid={`color-picker-${color}`}
          onClick={() => onColorSelect(color)}
          className={cn(
            "w-8 h-8 rounded-full border-2 transition-all hover-elevate active-elevate-2",
            selectedColor === color
              ? "border-foreground scale-110"
              : "border-muted-foreground/30"
          )}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
}
