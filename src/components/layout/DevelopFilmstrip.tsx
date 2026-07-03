import { useState } from "react";
import { ContextMenu, openContextMenu, type ContextMenuState } from "@/components/ContextMenu";
import { revealFileInExplorer } from "@/lib/revealFile";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { thumbnailSrc } from "@/features/library/thumbnailSrc";
import { FilmstripThumbnail } from "./FilmstripThumbnail";

export function DevelopFilmstrip() {
  const developQueue = useDevelopStore((s) => s.developQueue);
  const photoId = useDevelopStore((s) => s.photoId);
  const selectQueuePhoto = useDevelopStore((s) => s.selectQueuePhoto);
  const removeFromDevelopQueue = useDevelopStore((s) => s.removeFromDevelopQueue);
  const thumbnailCacheBust = useLibraryStore((s) => s.thumbnailCacheBust);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  if (developQueue.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-ae-border bg-ae-panel">
      <div className="flex h-24 items-center gap-2 overflow-x-auto px-3">
        {developQueue.map((item) => {
          const label = item.file_name ?? item.path.split(/[\\/]/).pop() ?? item.path;
          const isActive = item.id === photoId;
          return (
            <FilmstripThumbnail
              key={item.id}
              src={thumbnailSrc(item.thumbnail_path, thumbnailCacheBust)}
              alt={label}
              active={isActive}
              onSelect={() => void selectQueuePhoto(item.id)}
              onRemove={() => void removeFromDevelopQueue(item.id)}
              onContextMenu={(e) =>
                openContextMenu(
                  e,
                  [
                    {
                      label: "Switch to this photo",
                      onClick: () => void selectQueuePhoto(item.id),
                      disabled: isActive,
                    },
                    {
                      label: "Reveal in Explorer",
                      onClick: () => void revealFileInExplorer(item.path),
                    },
                    {
                      label: "Remove from develop queue",
                      destructive: true,
                      onClick: () => void removeFromDevelopQueue(item.id),
                    },
                  ],
                  setContextMenu,
                )
              }
            />
          );
        })}
      </div>
      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
