import { useState } from "react";
import { PlayerColorPicker } from "../PlayerColorPicker";

export default function PlayerColorPickerExample() {
  const [color, setColor] = useState("#ef4444");
  
  return (
    <div className="p-4">
      <PlayerColorPicker selectedColor={color} onColorSelect={setColor} />
    </div>
  );
}
