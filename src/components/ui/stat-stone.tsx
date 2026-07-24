import type { ReactNode } from "react";

type StatStoneProps = {
  value: string;
  label: string;
  helper?: string;
  shape: 1 | 2 | 3 | 4;
  tint: string;
  rotate?: number;
  corner?: ReactNode;
};

/* Floating metric pebble for the dashboard home. The corner slot hosts a
   decorative icon or the privacy tooltip trigger. */
export function StatStone({ value, label, helper, shape, tint, rotate = 0, corner }: StatStoneProps) {
  return (
    <article
      className={`stat-stone organic-shape-${shape}`}
      style={{ backgroundColor: tint, "--stone-rotate": `${rotate}deg` } as React.CSSProperties}
    >
      {corner ? <span className="stat-stone-corner">{corner}</span> : null}
      <strong>{value}</strong>
      <span>{label}</span>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}
