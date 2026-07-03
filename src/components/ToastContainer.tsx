import { IconClose } from "@/components/icons";
import { useToastStore } from "@/stores/useToastStore";

function folderLabel(folderPath: string): string {
  const parts = folderPath.split(/[\\/]/);
  return parts[parts.length - 1] || folderPath;
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);
  const openToastFolder = useToastStore((s) => s.openToastFolder);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-16 z-[100] flex w-[min(100vw-2rem,28rem)] flex-col gap-3"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-ae-accent/40 bg-ae-bg-secondary px-4 py-3 shadow-lg ring-1 ring-ae-accent/20"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              if (toast.folderPath) void openToastFolder(toast.folderPath);
            }}
          >
            <p className="text-base font-medium text-ae-text-primary">{toast.message}</p>
            {toast.folderPath && (
              <p className="mt-1 truncate text-sm text-ae-accent hover:underline">
                Open {folderLabel(toast.folderPath)}
              </p>
            )}
          </button>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 rounded p-0.5 text-ae-text-secondary hover:bg-ae-selection hover:text-ae-text-primary"
            aria-label="Dismiss"
          >
            <IconClose size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
