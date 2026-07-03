import { invoke } from "@tauri-apps/api/core";

export async function revealFileInExplorer(path: string) {
  await invoke("reveal_file_in_explorer", { path });
}
