import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDevelopStore } from "@/stores/useDevelopStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { syncLibrarySelectionToExportQueue } from "@/stores/useExportStore";
import { useFilmstripSelection } from "@/features/library/useFilmstripSelection";
import { useUIStore } from "@/stores/useUIStore";

const tabs = [
  { to: "/library", label: "Library", module: "library" as const },
  { to: "/develop", label: "Develop", module: "develop" as const },
  { to: "/export", label: "Export", module: "export" as const },
];

function goToExport(
  navigate: ReturnType<typeof useNavigate>,
  setActiveModule: (module: "export") => void,
) {
  const { selectedPhotoIds } = useFilmstripSelection.getState();
  const { photos } = useLibraryStore.getState();
  syncLibrarySelectionToExportQueue(selectedPhotoIds, photos);
  setActiveModule("export");
  navigate("/export");
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);
  const photoId = useDevelopStore((s) => s.photoId);

  return (
    <header className="flex h-12 items-center gap-4 border-b border-ae-border bg-ae-panel px-4">
      <span className="text-sm font-semibold text-ae-text-primary">Aramis Editor</span>
      <nav className="flex gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            onClick={() => {
              setActiveModule(tab.module);
              if (tab.module === "export") {
                const { selectedPhotoIds } = useFilmstripSelection.getState();
                const { photos } = useLibraryStore.getState();
                syncLibrarySelectionToExportQueue(selectedPhotoIds, photos);
              }
            }}
            className={`rounded px-3 py-1 text-sm ${
              location.pathname.startsWith(tab.to)
                ? "bg-ae-accent text-white"
                : "text-ae-muted hover:text-ae-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/settings"
          className={`rounded px-3 py-1 text-xs ${
            location.pathname.startsWith("/settings")
              ? "bg-ae-accent text-white"
              : "text-ae-muted hover:text-ae-text-primary"
          }`}
        >
          Settings
        </Link>
        <button
          type="button"
          disabled={photoId == null}
          onClick={() => setExportDialogOpen(true)}
          className="rounded bg-ae-bg-secondary px-3 py-1 text-xs text-ae-text-primary hover:bg-ae-border disabled:opacity-40"
        >
          Quick Export
        </button>
        <button
          type="button"
          onClick={() => goToExport(navigate, setActiveModule)}
          className="rounded bg-ae-accent px-3 py-1 text-xs text-white"
        >
          Batch Export
        </button>
      </div>
    </header>
  );
}
