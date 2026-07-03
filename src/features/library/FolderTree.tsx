import { open } from "@tauri-apps/plugin-dialog";
import { useEffect } from "react";
import { IconClose } from "@/components/icons";
import { useLibraryStore } from "@/stores/useLibraryStore";

export function FolderTree() {
  const folders = useLibraryStore((s) => s.folders);
  const selectedFolderId = useLibraryStore((s) => s.selectedFolderId);
  const foldersLoading = useLibraryStore((s) => s.foldersLoading);
  const error = useLibraryStore((s) => s.error);
  const refreshFolders = useLibraryStore((s) => s.refreshFolders);
  const importFolder = useLibraryStore((s) => s.importFolder);
  const removeFolder = useLibraryStore((s) => s.removeFolder);
  const selectFolder = useLibraryStore((s) => s.selectFolder);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  const onAddFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Import folder",
    });
    if (typeof selected === "string") {
      await importFolder(selected);
    }
  };

  return (
    <div className="flex h-full flex-col bg-ae-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ae-muted">Folders</h2>
        <button
          type="button"
          onClick={() => void onAddFolder()}
          className="rounded bg-ae-accent px-2 py-1 text-xs text-white"
        >
          Add Folder
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <ul className="flex-1 space-y-1 overflow-auto text-sm">
        {folders.map((folder) => (
          <li key={folder.id} className="group flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectFolder(folder.id)}
              className={`flex-1 truncate rounded px-2 py-1 text-left hover:bg-ae-bg ${
                selectedFolderId === folder.id ? "bg-ae-bg ring-1 ring-ae-accent" : ""
              }`}
              title={folder.path}
            >
              {folder.path.split(/[\\/]/).pop() ?? folder.path}
              <span className="ml-1 text-ae-muted">({folder.photo_count})</span>
            </button>
            <button
              type="button"
              onClick={() => void removeFolder(folder.id)}
              aria-label={`Remove ${folder.path.split(/[\\/]/).pop() ?? folder.path}`}
              className="rounded p-0.5 text-ae-muted opacity-0 hover:text-red-400 group-hover:opacity-100"
            >
              <IconClose size={12} />
            </button>
          </li>
        ))}
      </ul>
      <p className="h-4 text-xs text-ae-muted">
        {foldersLoading ? "Loading\u2026" : "\u00a0"}
      </p>
    </div>
  );
}
