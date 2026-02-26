import { DrawDialog } from "../DrawDialog";

export default function DrawDialogExample() {
  return (
    <DrawDialog
      onSelectPar={(par) => console.log("Selected par:", par)}
      onClose={() => console.log("Close")}
    />
  );
}
