import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLibraryStore } from "@/stores/useLibraryStore";

const BATCH_DELAY_MS = 120;
const POLL_INTERVAL_MS = 1500;

export function useLazyThumbnails(
  photoIdsMissingThumb: number[],
  enabled: boolean,
  folderId: number | null,
) {
  const pendingIds = useRef(new Set<number>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedIds = useRef(new Set<number>());

  const flush = useCallback(async () => {
    const ids = [...pendingIds.current];
    pendingIds.current.clear();
    if (ids.length === 0) return;

    for (const id of ids) {
      requestedIds.current.add(id);
    }

    try {
      await invoke<number>("generate_thumbnails", { photoIds: ids });
    } catch {
      for (const id of ids) {
        requestedIds.current.delete(id);
      }
    }
  }, []);

  const requestThumbnail = useCallback(
    (photoId: number) => {
      if (!enabled || requestedIds.current.has(photoId)) return;
      pendingIds.current.add(photoId);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flush();
      }, BATCH_DELAY_MS);
    },
    [enabled, flush],
  );

  useEffect(() => {
    requestedIds.current.clear();
    pendingIds.current.clear();
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
  }, [folderId, enabled]);

  useEffect(() => {
    if (!enabled || photoIdsMissingThumb.length === 0) return;

    const interval = setInterval(() => {
      const state = useLibraryStore.getState();
      if (state.selectedFolderId !== folderId) return;

      const stillMissing = state.photos.some(
        (p) => requestedIds.current.has(p.id) && !p.thumbnail_path,
      );
      if (!stillMissing) return;

      void state.refreshPhotos(folderId, { silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, folderId, photoIdsMissingThumb.length]);

  return requestThumbnail;
}
