import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDevelopStore } from "@/stores/useDevelopStore";
import type { EditStack, Preset } from "@/types/edits";

export function PresetsPanel() {
  const photoId = useDevelopStore((s) => s.photoId);
  const edits = useDevelopStore((s) => s.edits);
  const setEdits = useDevelopStore((s) => s.setEdits);
  const [presets, setPresets] = useState<Preset[]>([]);

  const load = useCallback(async () => {
    try {
      setPresets(await invoke<Preset[]>("list_presets"));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const folders = useMemo(() => {
    const map = new Map<string, Preset[]>();
    for (const p of presets) {
      const list = map.get(p.folder) ?? [];
      list.push(p);
      map.set(p.folder, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [presets]);

  const apply = async (presetId: number) => {
    if (photoId == null) return;
    try {
      const next = await invoke<EditStack>("apply_preset", { photoId, presetId });
      setEdits(next);
    } catch (e) {
      console.error(e);
    }
  };

  const savePreset = async (e: React.MouseEvent) => {
    e.preventDefault();
    const name = window.prompt("Preset name");
    if (!name) return;
    const folder = window.prompt("Folder name", "User Presets") ?? "User Presets";
    try {
      await invoke("create_preset", { name, folder, edits });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className="max-h-48 overflow-y-auto px-2 py-1 text-xs"
      onContextMenu={savePreset}
    >
      {folders.length === 0 ? (
        <p className="px-1 py-2 text-ae-text-secondary">Right-click to save current edits as preset.</p>
      ) : (
        folders.map(([folder, items]) => (
          <div key={folder} className="mb-2">
            <div className="px-1 py-0.5 font-medium text-ae-text-secondary">{folder}</div>
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={photoId == null}
                onClick={() => void apply(p.id)}
                className="block w-full truncate rounded px-2 py-1 text-left hover:bg-ae-bg-panel disabled:opacity-40"
              >
                {p.name}
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
