import { useLibraryStore } from "@/stores/useLibraryStore";
import { useFilmstripSelection } from "@/features/library/useFilmstripSelection";
import { thumbnailSrc } from "@/features/library/thumbnailSrc";
import { FilmstripThumbnail } from "./FilmstripThumbnail";

export function Filmstrip() {
  const photos = useLibraryStore((s) => s.photos);
  const thumbnailCacheBust = useLibraryStore((s) => s.thumbnailCacheBust);
  const { selectedPhotoIds, deselectPhoto } = useFilmstripSelection();
  const selected = photos.filter((p) => selectedPhotoIds.includes(p.id));

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
            />
          ))
        )}
      </div>
    </div>
  );
}
