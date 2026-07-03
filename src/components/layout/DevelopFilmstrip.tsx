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

  if (developQueue.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-ae-border bg-ae-panel">
      <div className="flex h-24 items-center gap-2 overflow-x-auto px-3">
        {developQueue.map((item) => {
          const label = item.file_name ?? item.path.split(/[\\/]/).pop() ?? item.path;
          return (
            <FilmstripThumbnail
              key={item.id}
              src={thumbnailSrc(item.thumbnail_path, thumbnailCacheBust)}
              alt={label}
              active={item.id === photoId}
              onSelect={() => void selectQueuePhoto(item.id)}
              onRemove={() => void removeFromDevelopQueue(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
