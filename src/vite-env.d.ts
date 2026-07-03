/// <reference types="vite/client" />

declare module "@tauri-apps/api/core" {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  export function convertFileSrc(filePath: string, protocol?: string): string;
}
