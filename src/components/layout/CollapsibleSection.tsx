import { type ReactNode } from "react";
import { IconChevronDown, IconChevronRight } from "@/components/icons";
import { EditToggleEye } from "./EditToggleEye";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useUIStore } from "@/stores/useUIStore";
import type { EditSectionId } from "@/types/edits";

export function CollapsibleSection({
  sectionId,
  title,
  editSectionId,
  children,
}: {
  sectionId: string;
  title: string;
  editSectionId?: EditSectionId;
  children: ReactNode;
}) {
  const collapsed = useUIStore((s) => s.isSectionCollapsed(sectionId));
  const toggleSection = useUIStore((s) => s.toggleSection);
  const allEditsEnabled = useDevelopStore((s) => s.allEditsEnabled);
  const sectionDisabled = useDevelopStore((s) => (editSectionId ? !!s.disabledSections[editSectionId] : false));
  const toggleSectionEdits = useDevelopStore((s) => s.toggleSectionEdits);

  const editsEnabled = editSectionId ? allEditsEnabled && !sectionDisabled : true;

  return (
    <section className="border-b border-ae-border">
      <button
        type="button"
        onClick={() => toggleSection(sectionId)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ae-text-primary hover:bg-ae-bg-panel"
      >
        <span>{title}</span>
        <span className="flex items-center gap-1.5">
          {editSectionId && (
            <EditToggleEye
              enabled={editsEnabled}
              onClick={() => toggleSectionEdits(editSectionId)}
              title={editsEnabled ? "Hide edits in preview" : "Show edits in preview"}
            />
          )}
          <span className="text-ae-text-secondary">
            {collapsed ? <IconChevronRight /> : <IconChevronDown />}
          </span>
        </span>
      </button>
      {!collapsed && children}
    </section>
  );
}
