import { useEffect } from "react";

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

export function ContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
}) {
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
      className="fixed z-50 min-w-[180px] rounded border border-ae-border bg-ae-panel py-1 shadow-lg"
      style={{ left: state.x, top: state.y }}
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
