import { useCallback, useEffect, useRef, useState } from "react";

import { useUIStore } from "@/stores/useUIStore";
import { cropAspectTarget } from "@/types/edits";

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "move";

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropOverlayProps {
  bounds: ImageBounds;
}

const MIN_SIZE = 0.05;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function constrainRect(x: number, y: number, w: number, h: number) {
  w = clamp(w, MIN_SIZE, 1);
  h = clamp(h, MIN_SIZE, 1);
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  return { x, y, width: w, height: h };
}

function applyAspectFromAnchor(
  w: number,
  h: number,
  target: number,
  anchorX: number,
  anchorY: number,
  growX: "left" | "right",
  growY: "top" | "bottom",
) {
  if (w / h > target) {
    w = h * target;
  } else {
    h = w / target;
  }

  const x = growX === "right" ? anchorX : anchorX - w;
  const y = growY === "bottom" ? anchorY : anchorY - h;
  return constrainRect(x, y, w, h);
}

function resizeCrop(
  handle: Handle,
  start: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  target: number | null,
) {
  let x = start.x;
  let y = start.y;
  let w = start.width;
  let h = start.height;

  switch (handle) {
    case "move":
      return constrainRect(start.x + dx, start.y + dy, w, h);
    case "se": {
      w = clamp(start.width + dx, MIN_SIZE, 1 - start.x);
      h = clamp(start.height + dy, MIN_SIZE, 1 - start.y);
      if (target) {
        return applyAspectFromAnchor(w, h, target, start.x, start.y, "right", "bottom");
      }
      return constrainRect(start.x, start.y, w, h);
    }
    case "nw": {
      const right = start.x + start.width;
      const bottom = start.y + start.height;
      x = clamp(start.x + dx, 0, right - MIN_SIZE);
      y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
      w = right - x;
      h = bottom - y;
      if (target) {
        return applyAspectFromAnchor(w, h, target, right, bottom, "left", "top");
      }
      return constrainRect(x, y, w, h);
    }
    case "ne": {
      const left = start.x;
      const bottom = start.y + start.height;
      y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
      w = clamp(start.width + dx, MIN_SIZE, 1 - left);
      h = bottom - y;
      if (target) {
        return applyAspectFromAnchor(w, h, target, left, bottom, "right", "top");
      }
      return constrainRect(left, y, w, h);
    }
    case "sw": {
      const right = start.x + start.width;
      const top = start.y;
      x = clamp(start.x + dx, 0, right - MIN_SIZE);
      w = right - x;
      h = clamp(start.height + dy, MIN_SIZE, 1 - top);
      if (target) {
        return applyAspectFromAnchor(w, h, target, right, top, "left", "bottom");
      }
      return constrainRect(x, top, w, h);
    }
    case "e": {
      w = clamp(start.width + dx, MIN_SIZE, 1 - start.x);
      if (target) {
        const centerY = start.y + start.height / 2;
        h = w / target;
        y = centerY - h / 2;
        return constrainRect(start.x, y, w, h);
      }
      return constrainRect(start.x, start.y, w, h);
    }
    case "w": {
      const right = start.x + start.width;
      x = clamp(start.x + dx, 0, right - MIN_SIZE);
      w = right - x;
      if (target) {
        const centerY = start.y + start.height / 2;
        h = w / target;
        y = centerY - h / 2;
        return constrainRect(x, y, w, h);
      }
      return constrainRect(x, start.y, w, h);
    }
    case "s": {
      h = clamp(start.height + dy, MIN_SIZE, 1 - start.y);
      if (target) {
        const centerX = start.x + start.width / 2;
        w = h * target;
        x = centerX - w / 2;
        return constrainRect(x, start.y, w, h);
      }
      return constrainRect(start.x, start.y, w, h);
    }
    case "n": {
      const bottom = start.y + start.height;
      y = clamp(start.y + dy, 0, bottom - MIN_SIZE);
      h = bottom - y;
      if (target) {
        const centerX = start.x + start.width / 2;
        w = h * target;
        x = centerX - w / 2;
        return constrainRect(x, y, w, h);
      }
      return constrainRect(start.x, y, w, h);
    }
    default:
      return constrainRect(x, y, w, h);
  }
}

export function CropOverlay({ bounds }: CropOverlayProps) {
  const pendingCrop = useUIStore((s) => s.pendingCrop);
  const setPendingCrop = useUIStore((s) => s.setPendingCrop);
  const confirmCrop = useUIStore((s) => s.confirmCrop);
  const cancelCrop = useUIStore((s) => s.cancelCrop);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startCrop: NonNullable<typeof pendingCrop>;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        confirmCrop();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelCrop();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmCrop, cancelCrop]);

  if (!pendingCrop) return null;

  const crop = pendingCrop;
  const cropLeft = bounds.x + crop.x * bounds.width;
  const cropTop = bounds.y + crop.y * bounds.height;
  const cropWidth = crop.width * bounds.width;
  const cropHeight = crop.height * bounds.height;

  const onPointerDown = useCallback(
    (handle: Handle) => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startCrop: { ...crop },
      };
      setDragging(true);
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [crop],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || bounds.width <= 0 || bounds.height <= 0) return;

      const dx = (event.clientX - drag.startX) / bounds.width;
      const dy = (event.clientY - drag.startY) / bounds.height;
      const target = cropAspectTarget(drag.startCrop.aspect_ratio);
      const next = resizeCrop(drag.handle, drag.startCrop, dx, dy, target);

      setPendingCrop(next);
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, bounds.width, bounds.height, setPendingCrop]);

  const handleSize = 10;
  const half = handleSize / 2;

  const cornerHandles: { id: Handle; style: React.CSSProperties; cursor: string }[] = [
    { id: "nw", style: { left: cropLeft - half, top: cropTop - half }, cursor: "nwse-resize" },
    { id: "ne", style: { left: cropLeft + cropWidth - half, top: cropTop - half }, cursor: "nesw-resize" },
    { id: "sw", style: { left: cropLeft - half, top: cropTop + cropHeight - half }, cursor: "nesw-resize" },
    { id: "se", style: { left: cropLeft + cropWidth - half, top: cropTop + cropHeight - half }, cursor: "nwse-resize" },
  ];

  const edgeHandles: { id: Handle; style: React.CSSProperties; cursor: string }[] = [
    { id: "n", style: { left: cropLeft + cropWidth / 2 - half, top: cropTop - half }, cursor: "ns-resize" },
    { id: "s", style: { left: cropLeft + cropWidth / 2 - half, top: cropTop + cropHeight - half }, cursor: "ns-resize" },
    { id: "w", style: { left: cropLeft - half, top: cropTop + cropHeight / 2 - half }, cursor: "ew-resize" },
    { id: "e", style: { left: cropLeft + cropWidth - half, top: cropTop + cropHeight / 2 - half }, cursor: "ew-resize" },
  ];

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute bg-black/50" style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: cropTop - bounds.y }} />
      <div
        className="absolute bg-black/50"
        style={{
          left: bounds.x,
          top: cropTop + cropHeight,
          width: bounds.width,
          height: bounds.y + bounds.height - cropTop - cropHeight,
        }}
      />
      <div className="absolute bg-black/50" style={{ left: bounds.x, top: cropTop, width: cropLeft - bounds.x, height: cropHeight }} />
      <div
        className="absolute bg-black/50"
        style={{
          left: cropLeft + cropWidth,
          top: cropTop,
          width: bounds.x + bounds.width - cropLeft - cropWidth,
          height: cropHeight,
        }}
      />

      <div
        className="pointer-events-auto absolute border border-white/80"
        style={{ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight, cursor: "move" }}
        onPointerDown={onPointerDown("move")}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>
      </div>

      {[...cornerHandles, ...edgeHandles].map(({ id, style, cursor }) => (
        <div
          key={id}
          className="pointer-events-auto absolute rounded-sm border border-white bg-ae-accent"
          style={{ ...style, width: handleSize, height: handleSize, cursor }}
          onPointerDown={onPointerDown(id)}
        />
      ))}

      <div
        className="pointer-events-auto absolute flex gap-2"
        style={{ left: bounds.x, top: bounds.y + bounds.height + 8 }}
      >
        <button
          type="button"
          onClick={confirmCrop}
          className="rounded bg-ae-accent px-3 py-1 text-xs text-white hover:opacity-90"
        >
          Done
        </button>
        <button
          type="button"
          onClick={cancelCrop}
          className="rounded bg-ae-bg-panel px-3 py-1 text-xs text-ae-text-primary hover:bg-ae-border"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
