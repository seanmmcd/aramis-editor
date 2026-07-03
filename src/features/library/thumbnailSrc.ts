import { convertFileSrc } from "@tauri-apps/api/core";

export function thumbnailSrc(
  path: string | null | undefined,
  cacheBust?: number,
): string | undefined {
  if (!path) return undefined;
  const src = convertFileSrc(path);
  if (!cacheBust) return src;
  return `${src}?v=${cacheBust}`;
}
