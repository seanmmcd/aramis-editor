import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ContextMenu, openContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { revealFileInExplorer } from "@/lib/revealFile";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { syncLibrarySelectionToExportQueue } from "@/stores/useExportStore";
import { useUIStore } from "@/stores/useUIStore";
import { useFilmstripSelection } from "./useFilmstripSelection";
import { thumbnailSrc } from "./thumbnailSrc";
import type { Photo } from "./types";

export function PhotoGrid() {
  const navigate = useNavigate();
  const {
    photos,
    searchResults,
    searchQuery,
    selectedFolderId,
    refreshPhotos,
    searchPhotos,
    removePhoto,
    photosLoading,
    refreshFolderThumbnails,
    thumbnailCacheBust,
  } = useLibraryStore();
  const { selectedPhotoIds, togglePhoto, setSelectedPhotoIds, clearSelection } =
    useFilmstripSelection();
  const openDevelopQueue = useDevelopStore((s) => s.openDevelopQueue);
  const setActiveModule = useUIStore((s) => s.setActiveModule);

  const [refreshingThumbs, setRefreshingThumbs] = useState(false);
  const [thumbRefreshPolling, setThumbRefreshPolling] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearchMode = searchQuery.trim().length > 0;
  const displayPhotos = isSearchMode ? (searchResults ?? []) : photos;
  const missingThumbCount = useMemo(
    () => displayPhotos.filter((p) => !p.thumbnail_path).length,
    [displayPhotos],
  );
  const thumbRefreshPollingRef = useRef(thumbRefreshPolling);
  thumbRefreshPollingRef.current = thumbRefreshPolling;

  const handleRefreshThumbnails = async () => {
    if (selectedFolderId == null || isSearchMode) return;
    setRefreshingThumbs(true);
    setThumbRefreshPolling(true);
    try {
      await refreshFolderThumbnails(selectedFolderId);
    } finally {
      setRefreshingThumbs(false);
    }
  };

  useEffect(() => {
    if (!isSearchMode && selectedFolderId != null) {
      void refreshPhotos(selectedFolderId);
    }
  }, [selectedFolderId, refreshPhotos, isSearchMode]);

  useEffect(() => {
    if (displayPhotos.length === 0) return;
    if (missingThumbCount === 0 && !thumbRefreshPolling) return;

    let stagnantPolls = 0;
    let lastMissing = missingThumbCount;

    const interval = setInterval(() => {
      const state = useLibraryStore.getState();
      const currentPhotos = isSearchMode ? (state.searchResults ?? []) : state.photos;
      const currentMissing = currentPhotos.filter((p) => !p.thumbnail_path).length;

      if (!thumbRefreshPollingRef.current) {
        if (currentMissing === lastMissing) {
          stagnantPolls += 1;
        } else {
          stagnantPolls = 0;
          lastMissing = currentMissing;
        }
        if (currentMissing === 0 || stagnantPolls >= 20) {
          clearInterval(interval);
          return;
        }
      }

      if (isSearchMode) {
        void state.searchPhotos(searchQuery, { silent: true });
      } else if (selectedFolderId != null) {
        void state.refreshPhotos(selectedFolderId, { silent: true });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [
    missingThumbCount,
    thumbRefreshPolling,
    displayPhotos.length,
    isSearchMode,
    searchQuery,
    selectedFolderId,
  ]);

  useEffect(() => {
    if (!thumbRefreshPolling) return;
    const timeout = setTimeout(() => setThumbRefreshPolling(false), 30_000);
    return () => clearTimeout(timeout);
  }, [thumbRefreshPolling]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" || selectedPhotoIds.length === 0) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
      setConfirmRemoveOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPhotoIds]);

  const onContextMenu = (e: React.MouseEvent, photo: Photo) => {
    if (!selectedPhotoIds.includes(photo.id)) {
      setSelectedPhotoIds([photo.id]);
    }
    openContextMenu(
      e,
      [
        {
          label: "Open in Develop",
          onClick: () => void openInDevelop(photo.id, photo.file_path),
        },
        {
          label: "Add to Export",
          onClick: () => {
            syncLibrarySelectionToExportQueue(
              selectedPhotoIds.includes(photo.id) ? selectedPhotoIds : [photo.id],
              displayPhotos,
            );
            setActiveModule("export");
            navigate("/export");
          },
        },
        {
          label: "Reveal in Explorer",
          onClick: () => void revealFileInExplorer(photo.file_path),
        },
        {
          label: "Remove from library",
          destructive: true,
          onClick: () => setConfirmRemoveOpen(true),
        },
      ],
      setContextMenu,
    );
  };

  const onSearchChange = (value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void searchPhotos(value);
    }, 250);
  };

  const openInDevelop = async (photoId: number, filePath: string) => {
    const photo = displayPhotos.find((p) => p.id === photoId);
    await openDevelopQueue([
      {
        id: photoId,
        path: filePath,
        file_name: photo?.file_name,
        thumbnail_path: photo?.thumbnail_path,
      },
    ]);
    setActiveModule("develop");
    navigate("/develop");
  };

  const openSelectedInDevelop = async () => {
    const items = displayPhotos
      .filter((p) => selectedPhotoIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        path: p.file_path,
        file_name: p.file_name,
        thumbnail_path: p.thumbnail_path,
      }));
    if (items.length === 0) return;
    await openDevelopQueue(items);
    setActiveModule("develop");
    navigate("/develop");
  };

  const confirmRemove = async () => {
    const ids = [...selectedPhotoIds];
    setConfirmRemoveOpen(false);
    clearSelection();
    for (const id of ids) {
      await removePhoto(id);
    }
  };

  const showEmptyFolder = !isSearchMode && selectedFolderId === null;
  const showNoResults = isSearchMode && !photosLoading && displayPhotos.length === 0;

  if (showEmptyFolder) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PhotoGridHeader
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedCount={0}
          onOpenInDevelop={() => void openSelectedInDevelop()}
          showRefreshThumbnails={false}
          onRefreshThumbnails={() => {}}
          refreshingThumbnails={false}
        />
        <div className="flex flex-1 items-center justify-center text-ae-muted">
          Select a folder to view photos, or search the library
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PhotoGridHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedCount={selectedPhotoIds.length}
        onOpenInDevelop={() => void openSelectedInDevelop()}
        showRefreshThumbnails={!isSearchMode && selectedFolderId != null}
        onRefreshThumbnails={() => void handleRefreshThumbnails()}
        refreshingThumbnails={refreshingThumbs}
      />

      {photosLoading && <p className="px-4 pt-2 text-sm text-ae-muted">Loading photos...</p>}
      {showNoResults && (
        <div className="flex flex-1 items-center justify-center text-ae-muted">
          No photos match &ldquo;{searchQuery.trim()}&rdquo;
        </div>
      )}

      {!showNoResults && (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {displayPhotos.map((photo) => (
              <PhotoGridItem
                key={photo.id}
                photo={photo}
                selected={selectedPhotoIds.includes(photo.id)}
                cacheBust={thumbnailCacheBust}
                onToggle={() => togglePhoto(photo.id)}
                onOpen={() => void openInDevelop(photo.id, photo.file_path)}
                onContextMenu={(e) => onContextMenu(e, photo)}
              />
            ))}
          </div>
        </div>
      )}

      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}

      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded border border-ae-border bg-ae-panel p-4 shadow-xl"
          >
            <h2 className="text-sm font-semibold text-ae-text-primary">Remove from library?</h2>
            <p className="mt-2 text-sm text-ae-muted">
              Remove {selectedPhotoIds.length} photo{selectedPhotoIds.length === 1 ? "" : "s"} from
              the library (files stay on disk).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveOpen(false)}
                className="rounded px-3 py-1 text-sm text-ae-muted hover:text-ae-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemove()}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PhotoGridItem = memo(function PhotoGridItem({
  photo,
  selected,
  cacheBust,
  onToggle,
  onOpen,
  onContextMenu,
}: {
  photo: Photo;
  selected: boolean;
  cacheBust: number;
  onToggle: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const src = thumbnailSrc(photo.thumbnail_path, cacheBust);

  return (
    <button
      type="button"
      onClick={onToggle}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className={`overflow-hidden rounded border bg-ae-panel text-left ${
        selected ? "border-ae-accent ring-2 ring-ae-accent" : "border-ae-border"
      }`}
    >
      <div className="aspect-square bg-ae-bg">
        {src ? (
          <img
            src={src}
            alt={photo.file_name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ae-muted">
            No preview
          </div>
        )}
      </div>
      <div className="truncate px-2 py-1 text-xs">{photo.file_name}</div>
    </button>
  );
});

function PhotoGridHeader({
  searchQuery,
  onSearchChange,
  selectedCount,
  onOpenInDevelop,
  showRefreshThumbnails,
  onRefreshThumbnails,
  refreshingThumbnails,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCount: number;
  onOpenInDevelop: () => void;
  showRefreshThumbnails: boolean;
  onRefreshThumbnails: () => void;
  refreshingThumbnails: boolean;
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      onSearchChange(value);
    },
    [onSearchChange],
  );

  return (
    <div className="flex items-center gap-3 border-b border-ae-border px-4 py-2">
      <input
        type="search"
        value={localQuery}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search entire library"
        className="min-w-0 flex-1 rounded border border-ae-border bg-ae-bg px-3 py-1.5 text-sm text-ae-text-primary placeholder:text-ae-muted"
      />
      {showRefreshThumbnails && (
        <button
          type="button"
          onClick={onRefreshThumbnails}
          disabled={refreshingThumbnails}
          className="shrink-0 rounded bg-ae-bg-panel px-3 py-1.5 text-sm text-ae-text-primary hover:bg-ae-border disabled:opacity-50"
        >
          {refreshingThumbnails ? "Refreshing..." : "Refresh thumbnails"}
        </button>
      )}
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={onOpenInDevelop}
          className="shrink-0 rounded bg-ae-accent px-3 py-1.5 text-sm text-white"
        >
          Open in Develop ({selectedCount})
        </button>
      )}
    </div>
  );
}
