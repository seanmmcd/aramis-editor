import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { notifyDevelopPersist, onDevelopPersist } from "@/stores/editsEvents";
import { applyRestoredEdits, createCheckpoint, useDevelopStore } from "@/stores/useDevelopStore";
import type { EditStack, Snapshot } from "@/types/edits";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SnapshotsPanel() {
  const photoId = useDevelopStore((s) => s.photoId);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const load = useCallback(async () => {
    if (photoId == null) {
      setSnapshots([]);
      return;
    }
    try {
      setSnapshots(await invoke<Snapshot[]>("list_snapshots", { photoId }));
    } catch (e) {
      console.error(e);
    }
  }, [photoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return onDevelopPersist((event) => {
      if (event.type === "checkpoints-changed" && event.photoId === photoId) {
        void load();
      }
    });
  }, [load, photoId]);

  const create = async () => {
    if (photoId == null) return;
    const name = window.prompt("Checkpoint name");
    if (!name?.trim()) return;
    const ok = await createCheckpoint(name.trim());
    if (ok) await load();
  };

  const restore = async (snapshotId: number) => {
    if (photoId == null) return;
    try {
      const next = await invoke<EditStack>("restore_snapshot", { photoId, snapshotId });
      applyRestoredEdits(next);
      notifyDevelopPersist({ type: "edits-saved", photoId });
      notifyDevelopPersist({ type: "checkpoints-changed", photoId });
    } catch (e) {
      console.error(e);
    }
  };

  if (photoId == null) {
    return (
      <p className="px-3 py-2 text-xs text-ae-text-secondary">
        Select a photo to manage checkpoints.
      </p>
    );
  }

  return (
    <div className="px-2 py-1 text-xs">
      <p className="mb-2 px-1 text-ae-text-secondary">
        Named checkpoints you can return to anytime.
      </p>
      <button
        type="button"
        onClick={() => void create()}
        className="mb-2 w-full rounded border border-ae-border px-2 py-1.5 font-medium text-ae-text-primary hover:bg-ae-bg-panel"
      >
        Create checkpoint
      </button>
      <div className="max-h-40 overflow-y-auto">
        {snapshots.length === 0 ? (
          <p className="px-1 py-2 text-ae-text-secondary">No checkpoints yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {snapshots.map((snap) => (
              <li key={snap.id}>
                <button
                  type="button"
                  onClick={() => void restore(snap.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-ae-bg-panel"
                  title={`Restore checkpoint: ${snap.name}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ae-text-primary">
                      {snap.name}
                    </span>
                    <span className="block text-ae-text-secondary">
                      {formatTimestamp(snap.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded border border-ae-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ae-accent">
                    Restore
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
