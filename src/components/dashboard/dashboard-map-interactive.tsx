"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { Plus, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DimensionIcon } from "@/components/ui/dimension-icon";
import {
  dimensionPresentations,
  getDimensionSurface,
  statusLabels,
} from "@/lib/dashboard/dimension-presentation";
import {
  deltaDirection,
  describeDelta,
  formatDelta,
} from "@/lib/dashboard/round-comparison";
import { isNudgeKey, nextNudgeOffset } from "@/lib/dashboard/map-nudge";
import { dashboardDimensionRoute } from "@/lib/navigation";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";
import { clamp } from "@/lib/utils/math";

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

const zeroOffsets = dimensionPresentations.reduce<StoneOffsetMap>((accumulator, dimension) => {
  accumulator[dimension.id] = { x: 0, y: 0 };
  return accumulator;
}, {});

function isValidOffsetMap(value: unknown): value is StoneOffsetMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return dimensionPresentations.every((dimension) => {
    const offset = (value as StoneOffsetMap)[dimension.id];
    return Boolean(offset) && typeof offset.x === "number" && typeof offset.y === "number";
  });
}

type DashboardMapInteractiveProps = {
  dimensionScores: Record<
    WellbeingDimensionId,
    { averageScore: number; computedStatus: WellbeingStatus }
  >;
  /** Carried into every stone link so a detail page opens the same round. */
  roundId: string;
  /**
   * Change per dimension against the previous round, or nothing when the school
   * has no comparable round yet.
   */
  dimensionDeltas: Record<WellbeingDimensionId, number> | null;
};

export function DashboardMapInteractive({
  dimensionScores,
  roundId,
  dimensionDeltas,
}: DashboardMapInteractiveProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const stoneRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);
  const offsetsRef = useRef<StoneOffsetMap>(zeroOffsets);
  const suppressClickIdRef = useRef<string | null>(null);
  const [offsets, setOffsets] = useState<StoneOffsetMap>(zeroOffsets);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    offsetsRef.current = offsets;
  }, [offsets]);

  /**
   * Restoring a dragged layout, one frame after hydration.
   *
   * The server renders every stone at its resting position, so a manager who
   * has moved the map sees it assemble twice. The obvious cure is a layout
   * effect, so the offsets land inside the hydration commit; it was tried and
   * measured on the local build, and it is noise — 35 frames at the default
   * position before, 32-36 after. The jump is hydration latency, not the frame
   * this effect waits for. Closing it means putting the offsets on the stones
   * before React runs at all — a blocking inline script, or a cookie the
   * server can read — and the owner decided on 2026-08-08 not to buy that for
   * a cosmetic half-second on one screen. This stays as it is.
   *
   * The frame is also what keeps `react-hooks/set-state-in-effect` satisfied,
   * so it is not free to remove either.
   */
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

  /**
   * How far this stone can still travel before it leaves the stage. Read from
   * the live rectangles rather than stored, because the stage resizes with the
   * window and a stale bound would let a stone escape it.
   */
  const boundsFor = useCallback((dimensionId: string) => {
    const stage = stageRef.current;
    const stone = stoneRefs.current[dimensionId];

    if (!stage || !stone) return null;

    const stageRect = stage.getBoundingClientRect();
    const stoneRect = stone.getBoundingClientRect();
    const current = offsetsRef.current[dimensionId] ?? { x: 0, y: 0 };

    return {
      current,
      minX: current.x - (stoneRect.left - stageRect.left),
      maxX: current.x + (stageRect.right - stoneRect.right),
      minY: current.y - (stoneRect.top - stageRect.top),
      maxY: current.y + (stageRect.bottom - stoneRect.bottom),
    };
  }, []);

  /**
   * Arrow keys move a focused stone, which is the keyboard equivalent of the
   * drag. The four arrows are consumed only while a stone has focus, so the
   * page still scrolls with the keyboard everywhere else — and a screen reader
   * in browse mode takes the arrows before the page ever sees them.
   */
  const handleKeyDown = useCallback(
    (dimensionId: string) => (event: React.KeyboardEvent<HTMLAnchorElement>) => {
      if (!isNudgeKey(event.key)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (typeof window !== "undefined" && window.innerWidth <= 980) return;

      const bounds = boundsFor(dimensionId);
      if (!bounds) return;

      event.preventDefault();
      setResetMessage("");

      // The step is taken from the offset React is holding rather than the one
      // measured a moment ago, so two arrow presses inside one render still add
      // up. The stage bounds stay valid either way: they were measured from the
      // stone where it currently sits.
      setOffsets((previous) => {
        const nextOffset = nextNudgeOffset(
          event.key,
          previous[dimensionId] ?? bounds.current,
          bounds,
          event.shiftKey,
        );
        if (!nextOffset) return previous;

        const updated = { ...previous, [dimensionId]: nextOffset };
        offsetsRef.current = updated;
        return updated;
      });
    },
    [boundsFor],
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

      const stone = stoneRefs.current[dimensionId];
      const bounds = boundsFor(dimensionId);

      if (!stone || !bounds) {
        return;
      }

      dragStateRef.current = {
        id: dimensionId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: bounds.current.x,
        baseY: bounds.current.y,
        minX: bounds.minX,
        maxX: bounds.maxX,
        minY: bounds.minY,
        maxY: bounds.maxY,
      };

      suppressClickIdRef.current = null;
      setResetMessage("");
      setDraggingId(dimensionId);
      stone.setPointerCapture?.(event.pointerId);
    },
    [boundsFor],
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

  const hasCustomLayout = useMemo(
    () =>
      dimensionPresentations.some((dimension) => {
        const offset = offsets[dimension.id];
        return Boolean(offset) && (offset.x !== 0 || offset.y !== 0);
      }),
    [offsets],
  );

  const resetLayout = useCallback(() => {
    setOffsets(zeroOffsets);
    offsetsRef.current = zeroOffsets;

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }

    // The reset control only exists while the map is rearranged, so pressing it
    // removes the element that has focus. Focus moves to the map itself and the
    // outcome is announced, instead of both being lost to the document body.
    setResetMessage("סידור המפה אופס. האבנים חזרו למקומן המקורי.");
    stageRef.current?.focus();
  }, []);

  return (
    <section
      ref={stageRef}
      className={stageClassName}
      aria-label="מפת השלומות לפי ממדים"
      tabIndex={-1}
    >
      <p className="visually-hidden" role="status">
        {resetMessage}
      </p>
      {hasCustomLayout ? (
        <button type="button" className="map-reset-button" onClick={resetLayout}>
          <Undo2 size={16} aria-hidden="true" />
          איפוס סידור המפה
        </button>
      ) : null}
      {dimensionPresentations.map((dimension, index) => {
        const { averageScore: score, computedStatus: status } =
          dimensionScores[dimension.id as WellbeingDimensionId];
        const offset = offsets[dimension.id] ?? zeroOffsets[dimension.id];
        const dragX = offset.x;
        const dragY = offset.y;
        const displayStatusLabel =
          status === "green" ? "חוזקה לשימור" : statusLabels[status];
        const delta = dimensionDeltas?.[dimension.id as WellbeingDimensionId];

        return (
          <Link
            key={dimension.id}
            ref={registerStoneRef(dimension.id)}
            href={dashboardDimensionRoute(dimension.id, roundId)}
            className={`dashboard-map-blob${draggingId === dimension.id ? " is-dragging" : ""}`}
            style={
              {
                "--blob-rotate": `${dimension.conceptPosition.rotate}deg`,
                "--blob-counter-rotate": `${dimension.conceptPosition.rotate * -1}deg`,
                "--drag-x": `${dragX}px`,
                "--drag-y": `${dragY}px`,
                "--plus-top": dimension.plusPosition.top,
                "--plus-left": dimension.plusPosition.left,
                top: dimension.conceptPosition.top,
                right: dimension.conceptPosition.right,
                width: dimension.conceptPosition.width,
                height: dimension.conceptPosition.height,
                borderRadius: dimension.conceptPosition.radius,
                backgroundColor: getDimensionSurface(status),
                zIndex: draggingId === dimension.id ? 20 : undefined,
              } as CSSProperties
            }
            data-drag-x={Math.round(dragX)}
            data-drag-y={Math.round(dragY)}
            data-dimension={dimension.id}
            data-stone-index={String(index + 1).padStart(2, "0")}
            aria-label={`${dimension.conceptLabel}: ${dimension.subtitle}. ציון ${score}, ${displayStatusLabel}${
              delta === undefined ? "" : `, ${describeDelta(delta)} מהסבב הקודם`
            }`}
            draggable={false}
            onPointerDown={handlePointerDown(dimension.id)}
            onKeyDown={handleKeyDown(dimension.id)}
            onClick={handleClick(dimension.id)}
            onDragStart={(event) => event.preventDefault()}
          >
            <span className="dashboard-map-blob-plus" aria-hidden="true">
              <Plus size={30} strokeWidth={2.25} />
            </span>
            <span className="dashboard-map-blob-copy">
              <span className="dashboard-map-blob-icon" aria-hidden="true">
                <DimensionIcon dimensionId={dimension.id} size={22} />
              </span>
              <strong>{dimension.conceptLabel}</strong>
              <span className="dashboard-map-blob-score">
                {score}%
                {delta === undefined ? null : (
                  <span
                    className={`round-delta round-delta-${deltaDirection(delta)}`}
                    aria-hidden="true"
                  >
                    {formatDelta(delta)}
                  </span>
                )}
              </span>
            </span>
            <span className="dashboard-map-blob-status">
              <span className={`status-dot status-${status}`} aria-hidden="true" />
              {displayStatusLabel}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
