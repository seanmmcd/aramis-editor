import { useEffect, useLayoutEffect, useRef } from "react";

const VIEWPORT_PADDING = 8;

export type ContextMenuItem = {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
};

function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const maxX = window.innerWidth - width - VIEWPORT_PADDING;
  const maxY = window.innerHeight - height - VIEWPORT_PADDING;

  let nextX = x;
  let nextY = y;

  if (nextX + width > window.innerWidth - VIEWPORT_PADDING) {
    nextX = x - width;
  }
  if (nextY + height > window.innerHeight - VIEWPORT_PADDING) {
    nextY = y - height;
  }

  return {
    x: Math.min(Math.max(nextX, VIEWPORT_PADDING), maxX),
    y: Math.min(Math.max(nextY, VIEWPORT_PADDING), maxY),
  };
}

export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!state || !menu) return;

    const { width, height } = menu.getBoundingClientRect();
    const { x, y } = clampMenuPosition(state.x, state.y, width, height);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = "visible";
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded border border-ae-border bg-ae-panel py-1 shadow-lg"
      style={{ left: state.x, top: state.y, visibility: "hidden" }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-ae-bg disabled:opacity-40 ${
            item.destructive ? "text-red-400" : ""
          }`}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function openContextMenu(
  event: React.MouseEvent,
  items: ContextMenuItem[],
  setMenu: (state: ContextMenuState | null) => void,
) {
  event.preventDefault();
  event.stopPropagation();
  setMenu({ x: event.clientX, y: event.clientY, items });
}

export type { ContextMenuState };
