import { LeftPanel } from "./LeftPanel";
import { CanvasArea } from "./CanvasArea";
import { RightPanel } from "./RightPanel";

export function MainWorkspace() {
  return (
    <div className="flex min-h-0 flex-1">
      <LeftPanel />
      <CanvasArea />
      <RightPanel />
    </div>
  );
}
