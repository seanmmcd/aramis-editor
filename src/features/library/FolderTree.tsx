import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import { IconClose } from "@/components/icons";
import { Spinner } from "@/components/Spinner";
import { useLibraryStore } from "@/stores/useLibraryStore";
import {
  ancestorFolderIds,
  buildFolderTree,
  folderDisplayName,
  type FolderNode,
} from "./folderTreeUtils";

export function FolderTree() {
  const folders = useLibraryStore((s) => s.folders);
  const selectedFolderId = useLibraryStore((s) => s.selectedFolderId);
  const foldersLoading = useLibraryStore((s) => s.foldersLoading);
  const isImporting = useLibraryStore((s) => s.isImporting);
  const error = useLibraryStore((s) => s.error);
  const refreshFolders = useLibraryStore((s) => s.refreshFolders);
  const importFolder = useLibraryStore((s) => s.importFolder);
  const removeFolder = useLibraryStore((s) => s.removeFolder);
  const selectFolder = useLibraryStore((s) => s.selectFolder);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  useEffect(() => {
    if (selectedFolderId == null) return;
    const ancestors = ancestorFolderIds(folders, selectedFolderId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of ancestors) {
        next.add(id);
      }
      return next;
    });
  }, [folders, selectedFolderId]);

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

  const toggleExpanded = (folderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col bg-ae-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ae-muted">Folders</h2>
        <button
          type="button"
          disabled={isImporting}
          onClick={() => void onAddFolder()}
          className="flex items-center gap-1.5 rounded bg-ae-accent px-2 py-1 text-xs text-white disabled:opacity-60"
        >
          {isImporting && <Spinner size={12} className="border-white/30 border-t-white" />}
          Add Folder
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <ul className="flex-1 space-y-0.5 overflow-auto text-sm">
        {tree.map((node) => (
          <FolderTreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            onToggleExpanded={toggleExpanded}
            onSelect={selectFolder}
            onRemove={(id) => void removeFolder(id)}
          />
        ))}
      </ul>
      {(isImporting || foldersLoading) && (
        <p className="flex h-4 items-center gap-1.5 text-xs text-ae-muted">
          <Spinner size={12} />
          {isImporting ? "Importing folder\u2026" : "Loading\u2026"}
        </p>
      )}
      {!isImporting && !foldersLoading && <p className="h-4 text-xs text-ae-muted">{"\u00a0"}</p>}
    </div>
  );
}

function FolderTreeNode({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  onToggleExpanded,
  onSelect,
  onRemove,
}: {
  node: FolderNode;
  depth: number;
  selectedFolderId: number | null;
  expandedIds: Set<number>;
  onToggleExpanded: (folderId: number) => void;
  onSelect: (folderId: number) => void;
  onRemove: (folderId: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const name = folderDisplayName(node.path);

  return (
    <li>
      <div
        className="group flex items-center gap-1"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(node.id)}
            aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ae-muted hover:bg-ae-bg hover:text-ae-text-primary"
          >
            <span className="text-[10px] leading-none">{expanded ? "▼" : "▶"}</span>
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left hover:bg-ae-selection ${
            selectedFolderId === node.id
              ? "bg-ae-selection font-medium text-ae-text-primary ring-1 ring-ae-accent"
              : "text-ae-text-primary"
          }`}
          title={node.path}
        >
          {name}
          <span className="ml-1 text-ae-muted">({node.photo_count})</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(node.id)}
          aria-label={`Remove ${name}`}
          className="rounded p-0.5 text-ae-muted opacity-0 hover:text-red-400 group-hover:opacity-100"
        >
          <IconClose size={12} />
        </button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onToggleExpanded={onToggleExpanded}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
