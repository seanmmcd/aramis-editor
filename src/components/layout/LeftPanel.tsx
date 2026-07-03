import { CollapsibleSection } from "./CollapsibleSection";
import { PresetsPanel } from "@/features/presets/PresetsPanel";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { SnapshotsPanel } from "@/features/snapshots/SnapshotsPanel";

export function LeftPanel() {
  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-ae-border bg-ae-bg-secondary">
      <CollapsibleSection sectionId="presets" title="Presets">
        <PresetsPanel />
      </CollapsibleSection>
      <CollapsibleSection sectionId="snapshots" title="Checkpoints">
        <SnapshotsPanel />
      </CollapsibleSection>
      <CollapsibleSection sectionId="history" title="History">
        <HistoryPanel />
      </CollapsibleSection>
    </aside>
  );
}
