import type { Folder } from "./types";

export type FolderNode = Folder & { children: FolderNode[] };

export function folderDisplayName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const nodes = new Map<number, FolderNode>();
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  for (const folder of folders) {
    const node = nodes.get(folder.id);
    if (!node) continue;
    if (folder.parent_id == null) {
      roots.push(node);
    } else {
      nodes.get(folder.parent_id)?.children.push(node);
    }
  }

  const sortNodes = (list: FolderNode[]) => {
    list.sort((a, b) => folderDisplayName(a.path).localeCompare(folderDisplayName(b.path)));
    for (const node of list) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

export function ancestorFolderIds(folders: Folder[], folderId: number): number[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const ids: number[] = [];
  let current = byId.get(folderId);
  while (current) {
    ids.push(current.id);
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined;
  }
  return ids;
}
