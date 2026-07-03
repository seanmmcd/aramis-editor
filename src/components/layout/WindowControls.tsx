import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconClose } from "@/components/icons";

function isTauriApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function IconMinimize({ className = "" }: { className?: string }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" className={className} aria-hidden>
      <rect x={1} y={4.5} width={8} height={1} fill="currentColor" />
    </svg>
  );
}

function IconMaximize({ className = "" }: { className?: string }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" className={className} aria-hidden>
      <rect
        x={1.5}
        y={1.5}
        width={7}
        height={7}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}

function IconRestore({ className = "" }: { className?: string }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" className={className} aria-hidden>
      <path
        d="M3.5 2.5h4v4H3.5V2.5zm1 1v2h2v-2H4.5zm2.5 2.5h4v4h-4V6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  const syncMaximized = useCallback(async () => {
    if (!isTauriApp()) return;
    setMaximized(await getCurrentWindow().isMaximized());
  }, []);

  useEffect(() => {
    if (!isTauriApp()) return;
    void syncMaximized();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onResized(() => {
        if (!disposed) void syncMaximized();
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [syncMaximized]);

  if (!isTauriApp()) return null;

  const appWindow = getCurrentWindow();

  return (
    <div className="flex h-full shrink-0 items-stretch">
      <button
        type="button"
        title="Minimize"
        onClick={() => void appWindow.minimize()}
        className="ae-window-control inline-flex w-[46px] items-center justify-center text-ae-text-primary"
      >
        <IconMinimize />
      </button>
      <button
        type="button"
        title={maximized ? "Restore" : "Maximize"}
        onClick={() => void appWindow.toggleMaximize()}
        className="ae-window-control inline-flex w-[46px] items-center justify-center text-ae-text-primary"
      >
        {maximized ? <IconRestore /> : <IconMaximize />}
      </button>
      <button
        type="button"
        title="Close"
        onClick={() => void appWindow.close()}
        className="ae-window-control ae-window-control-close inline-flex w-[46px] items-center justify-center text-ae-text-primary"
      >
        <IconClose size={10} />
      </button>
    </div>
  );
}

export function useTitlebarDoubleClickMaximize() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!isTauriApp() || e.button !== 0) return;
    if (e.detail === 2) {
      e.preventDefault();
      void getCurrentWindow().toggleMaximize();
    }
  }, []);
}
