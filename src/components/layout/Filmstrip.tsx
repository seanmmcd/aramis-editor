import { useNavigate } from "react-router-dom";
import { ContextMenu, openContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { revealFileInExplorer } from "@/lib/revealFile";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { syncLibrarySelectionToExportQueue } from "@/stores/useExportStore";
import { useUIStore } from "@/stores/useUIStore";
import { useFilmstripSelection } from "@/features/library/useFilmstripSelection";
import { thumbnailSrc } from "@/features/library/thumbnailSrc";
import { FilmstripThumbnail } from "./FilmstripThumbnail";
import { useState } from "react";

export function Filmstrip() {
  const navigate = useNavigate();
  const photos = useLibraryStore((s) => s.photos);
  const thumbnailCacheBust = useLibraryStore((s) => s.thumbnailCacheBust);
  const removePhoto = useLibraryStore((s) => s.removePhoto);
  const { selectedPhotoIds, deselectPhoto } = useFilmstripSelection();
  const openDevelopQueue = useDevelopStore((s) => s.openDevelopQueue);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const selected = photos.filter((p) => selectedPhotoIds.includes(p.id));
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const openInDevelop = async (photo: (typeof selected)[number]) => {
    await openDevelopQueue([
      {
        id: photo.id,
        path: photo.file_path,
        file_name: photo.file_name,
        thumbnail_path: photo.thumbnail_path,
      },
    ]);
    setActiveModule("develop");
    navigate("/develop");
  };

  return (
    <div className="shrink-0 border-t border-ae-border bg-ae-panel">
      <div className="flex h-24 items-center gap-2 overflow-x-auto px-3">
        {selected.length === 0 ? (
          <span className="shrink-0 text-xs text-ae-muted">Select photos in the grid</span>
        ) : (
          selected.map((photo) => (
            <FilmstripThumbnail
              key={photo.id}
              src={thumbnailSrc(photo.thumbnail_path, thumbnailCacheBust)}
              alt={photo.file_name}
              onSelect={() => {}}
              onRemove={() => deselectPhoto(photo.id)}
              onContextMenu={(e) =>
                openContextMenu(
                  e,
                  [
                    {
                      label: "Open in Develop",
                      onClick: () => void openInDevelop(photo),
                    },
                    {
                      label: "Add to Export",
                      onClick: () => {
                        syncLibrarySelectionToExportQueue([photo.id], photos);
                        setActiveModule("export");
                        navigate("/export");
                      },
                    },
                    {
                      label: "Deselect",
                      onClick: () => deselectPhoto(photo.id),
                    },
                    {
                      label: "Reveal in Explorer",
                      onClick: () => void revealFileInExplorer(photo.file_path),
                    },
                    {
                      label: "Remove from library",
                      destructive: true,
                      onClick: () => void removePhoto(photo.id),
                    },
                  ],
                  setContextMenu,
                )
              }
            />
          ))
        )}
      </div>
      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
