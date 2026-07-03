import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { onDevelopPersist } from "@/stores/editsEvents";
import { applyRestoredEdits, useDevelopStore } from "@/stores/useDevelopStore";
import type { EditStack, HistoryEntry } from "@/types/edits";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryPanel() {
  const photoId = useDevelopStore((s) => s.photoId);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const load = useCallback(async () => {
    if (photoId == null) {
      setEntries([]);
      return;
    }
    try {
      setEntries(await invoke<HistoryEntry[]>("list_history", { photoId }));
    } catch (e) {
      console.error(e);
    }
  }, [photoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return onDevelopPersist((event) => {
      if (event.type === "edits-saved" && event.photoId === photoId) {
        void load();
      }
    });
  }, [load, photoId]);

  const restore = async (historyId: number) => {
    if (photoId == null) return;
    try {
      const next = await invoke<EditStack>("restore_history", { photoId, historyId });
      applyRestoredEdits(next);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const restoreOriginal = async () => {
    if (photoId == null) return;
    try {
      const next = await invoke<EditStack>("restore_original", { photoId });
      applyRestoredEdits(next);
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  if (photoId == null) {
    return (
      <p className="px-3 py-2 text-xs text-ae-text-secondary">
        Select a photo to view edit history.
      </p>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto px-2 py-1 text-xs">
      <p className="mb-1 px-1 text-ae-text-secondary">
        Auto-saved steps. Revert trims newer history from that point.
      </p>
      {entries.length === 0 ? (
        <p className="px-1 py-2 text-ae-text-secondary">No history yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {entries.map((entry, index) => {
            const isOldest = index === entries.length - 1;
            return (
              <li key={entry.id}>
                <div className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-ae-bg-panel">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ae-text-primary">
                      {entry.label}
                    </span>
                    <span className="block text-ae-text-secondary">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => void restore(entry.id)}
                      className="rounded border border-ae-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ae-accent hover:bg-ae-bg-panel"
                      title={`Revert to: ${entry.label}`}
                    >
                      Revert
                    </button>
                    {isOldest && (
                      <button
                        type="button"
                        onClick={() => void restoreOriginal()}
                        className="rounded border border-ae-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ae-text-secondary hover:bg-ae-bg-panel hover:text-ae-text-primary"
                        title="Restore original settings before edits"
                      >
                        Original
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
