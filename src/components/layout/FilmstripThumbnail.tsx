import { IconClose } from "@/components/icons";
import { Spinner } from "@/components/Spinner";

type Props = {
  src?: string;
  alt: string;
  active?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

export function FilmstripThumbnail({ src, alt, active, onSelect, onRemove, onContextMenu }: Props) {
  return (
    <div className="relative h-16 w-16 shrink-0">
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        title={alt}
        className={`h-full w-full overflow-hidden rounded border ${
          active ? "border-ae-accent ring-2 ring-ae-accent" : "border-ae-border"
        }`}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-ae-bg">
            <Spinner size={20} />
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${alt}`}
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-ae-border bg-ae-panel text-ae-muted shadow hover:bg-red-600 hover:text-white"
      >
        <IconClose size={10} />
      </button>
    </div>
  );
}
