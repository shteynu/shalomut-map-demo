"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wellbeingDimensions } from "@/lib/demo-data";

const DRAG_THRESHOLD = 6;
const LAYOUT_STORAGE_KEY = "shalomut-map-stones-v2";

type StoneOffset = {
  x: number;
  y: number;
};

type StoneOffsetMap = Record<string, StoneOffset>;

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const zeroOffsets = wellbeingDimensions.reduce<StoneOffsetMap>((accumulator, dimension) => {
  accumulator[dimension.id] = { x: 0, y: 0 };
  return accumulator;
}, {});

function getDimensionHref(dimensionId: string) {
  return `/dashboard/${dimensionId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isValidOffsetMap(value: unknown): value is StoneOffsetMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return wellbeingDimensions.every((dimension) => {
    const offset = (value as StoneOffsetMap)[dimension.id];
    return Boolean(offset) && typeof offset.x === "number" && typeof offset.y === "number";
  });
}

function getPlusPosition(dimensionId: string) {
  switch (dimensionId) {
    case "self-expression": // קול אישי
      return { top: "1.4rem", left: "2.0rem" };
    case "professional-competence": // מומחיות בטוחה
      return { top: "1.2rem", left: "2.8rem" };
    case "social-resource": // משאב חברתי
      return { top: "1.8rem", left: "2.4rem" };
    case "balance": // איזון
      return { top: "1.5rem", left: "2.9rem" };
    case "management-support": // עורף מקצועי
      return { top: "1.3rem", left: "3.6rem" };
    case "certainty": // ודאות
      return { top: "1.7rem", left: "2.1rem" };
    case "organizational-climate": // אקלים ארגוני
      return { top: "1.2rem", left: "3.3rem" };
    case "meaning": // משמעות
      return { top: "1.6rem", left: "2.7rem" };
    default:
      return { top: "1.4rem", left: "2.0rem" };
  }
}

export function DashboardMapInteractive() {
  const stageRef = useRef<HTMLElement | null>(null);
  const stoneRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const offsetsRef = useRef<StoneOffsetMap>(zeroOffsets);
  const suppressClickIdRef = useRef<string | null>(null);
  const [offsets, setOffsets] = useState<StoneOffsetMap>(zeroOffsets);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    offsetsRef.current = offsets;
  }, [offsets]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let restoreFrame = 0;

    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed: unknown = JSON.parse(stored);

      if (isValidOffsetMap(parsed)) {
        restoreFrame = window.requestAnimationFrame(() => {
          setOffsets(parsed);
          offsetsRef.current = parsed;
        });
      }
    } catch {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }

    return () => {
      if (restoreFrame) {
        window.cancelAnimationFrame(restoreFrame);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(offsets));
  }, [offsets]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
        suppressClickIdRef.current = dragState.id;
      }

      const nextOffset = {
        x: clamp(dragState.baseX + deltaX, dragState.minX, dragState.maxX),
        y: clamp(dragState.baseY + deltaY, dragState.minY, dragState.maxY),
      };

      setOffsets((previous) => {
        const current = previous[dragState.id];

        if (current.x === nextOffset.x && current.y === nextOffset.y) {
          return previous;
        }

        const updated = {
          ...previous,
          [dragState.id]: nextOffset,
        };

        offsetsRef.current = updated;
        return updated;
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const stone = stoneRefs.current[dragState.id];
      stone?.releasePointerCapture?.(event.pointerId);
      dragStateRef.current = null;
      setDraggingId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const registerStoneRef = useCallback(
    (dimensionId: string) => (node: HTMLAnchorElement | null) => {
      stoneRefs.current[dimensionId] = node;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (dimensionId: string) => (event: ReactPointerEvent<HTMLAnchorElement>) => {
      if (event.button !== 0) {
        return;
      }

      if (typeof window !== "undefined" && window.innerWidth <= 980) {
        return;
      }

      event.preventDefault();

      const stage = stageRef.current;
      const stone = stoneRefs.current[dimensionId];

      if (!stage || !stone) {
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const stoneRect = stone.getBoundingClientRect();
      const currentOffset = offsetsRef.current[dimensionId] ?? { x: 0, y: 0 };

      dragStateRef.current = {
        id: dimensionId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: currentOffset.x,
        baseY: currentOffset.y,
        minX: currentOffset.x - (stoneRect.left - stageRect.left),
        maxX: currentOffset.x + (stageRect.right - stoneRect.right),
        minY: currentOffset.y - (stoneRect.top - stageRect.top),
        maxY: currentOffset.y + (stageRect.bottom - stoneRect.bottom),
      };

      suppressClickIdRef.current = null;
      setDraggingId(dimensionId);
      stone.setPointerCapture?.(event.pointerId);
    },
    [],
  );

  const handleClick = useCallback(
    (dimensionId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (suppressClickIdRef.current === dimensionId) {
        event.preventDefault();
        suppressClickIdRef.current = null;
      }
    },
    [],
  );

  const stageClassName = useMemo(() => `dashboard-map-stage${draggingId ? " is-dragging" : ""}`, [draggingId]);

  return (
    <section ref={stageRef} className={stageClassName} aria-label="מפת השלומות לפי ממדים">
      {wellbeingDimensions.map((dimension) => {
        const offset = offsets[dimension.id] ?? zeroOffsets[dimension.id];
        const dragX = offset.x;
        const dragY = offset.y;

        return (
          <Link
            key={dimension.id}
            ref={registerStoneRef(dimension.id)}
            href={getDimensionHref(dimension.id)}
            className={`dashboard-map-blob${draggingId === dimension.id ? " is-dragging" : ""}`}
            style={
              {
                "--blob-rotate": `${dimension.conceptPosition.rotate}deg`,
                "--blob-counter-rotate": `${dimension.conceptPosition.rotate * -1}deg`,
                "--drag-x": `${dragX}px`,
                "--drag-y": `${dragY}px`,
                "--plus-top": getPlusPosition(dimension.id).top,
                "--plus-left": getPlusPosition(dimension.id).left,
                top: dimension.conceptPosition.top,
                right: dimension.conceptPosition.right,
                width: dimension.conceptPosition.width,
                height: dimension.conceptPosition.height,
                borderRadius: dimension.conceptPosition.radius,
                backgroundColor: dimension.conceptColor,
                zIndex: draggingId === dimension.id ? 20 : undefined,
              } as CSSProperties
            }
            data-drag-x={Math.round(dragX)}
            data-drag-y={Math.round(dragY)}
            aria-label={`${dimension.conceptLabel}: ${dimension.subtitle}`}
            draggable={false}
            onPointerDown={handlePointerDown(dimension.id)}
            onClick={handleClick(dimension.id)}
            onDragStart={(event) => event.preventDefault()}
          >
            <span className="dashboard-map-blob-plus" aria-hidden="true">
              <Plus size={42} strokeWidth={2.25} />
            </span>
            <span className="dashboard-map-blob-copy">
              <strong>{dimension.conceptLabel}</strong>
              <span>{dimension.subtitle}</span>
            </span>
            <span className="dashboard-map-blob-status">
              {dimension.conceptStatusText}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
