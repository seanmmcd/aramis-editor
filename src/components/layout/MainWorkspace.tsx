import { LeftPanel } from "./LeftPanel";
import { CanvasArea } from "./CanvasArea";
import { RightPanel } from "./RightPanel";

import { useUIStore } from "@/stores/useUIStore";

export function MainWorkspace() {
  const leftVisible = useUIStore((s) => s.developLeftPanelVisible);
  const rightVisible = useUIStore((s) => s.developRightPanelVisible);

  return (
    <div className="flex min-h-0 flex-1">
      {leftVisible && <LeftPanel />}
      <CanvasArea />
      {rightVisible && <RightPanel />}
    </div>
  );
}
