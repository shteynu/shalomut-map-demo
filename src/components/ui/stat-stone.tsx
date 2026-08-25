import type { ReactNode } from "react";

type StatStoneProps = {
  value: string;
  /**
   * Read instead of `value` when the visible one is a typographic stand-in — a
   * dash announces as nothing a manager can act on.
   */
  screenReaderValue?: string;
  label: string;
  helper?: string;
  shape: 1 | 2 | 3 | 4;
  tint: string;
  rotate?: number;
  /**
   * A decorative icon, or the privacy tooltip trigger. It leads the column
   * rather than sitting in a corner: these stones are organic shapes, and
   * every one of the four `organic-shape-*` radii leaves its own bounding-box
   * corners empty, so an absolutely positioned mark floated on the cream
   * outside the stone it belonged to.
   */
  mark?: ReactNode;
  /**
   * An explanation attached to the label, not to the stone. The privacy
   * tooltip goes here rather than in `mark` so the panel opens below the words
   * it qualifies instead of over the number it is about — and so it sits where
   * the round screen's own cards already put it.
   */
  labelNote?: ReactNode;
};

/* Floating metric pebble for the dashboard home. */
export function StatStone({
  value,
  screenReaderValue,
  label,
  helper,
  shape,
  tint,
  rotate = 0,
  mark,
  labelNote,
}: StatStoneProps) {
  return (
    <article
      className={`stat-stone organic-shape-${shape}`}
      style={{ backgroundColor: tint, "--stone-rotate": `${rotate}deg` } as React.CSSProperties}
    >
      {mark ? <span className="stat-stone-mark">{mark}</span> : null}
      {screenReaderValue ? (
        <>
          <strong aria-hidden="true">{value}</strong>
          <span className="visually-hidden">{screenReaderValue}</span>
        </>
      ) : (
        <strong>{value}</strong>
      )}
      <span className="stat-stone-label">
        {label}
        {labelNote}
      </span>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}
