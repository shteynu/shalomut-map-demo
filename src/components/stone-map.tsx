"use client";

import Link from "next/link";
import { ChevronLeft, MousePointer2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { WellbeingDimension } from "@/lib/demo-data";
import { statusLabels, wellbeingDimensions } from "@/lib/demo-data";
import { StatusBadge } from "@/components/status";

export function StoneMap() {
  const [selectedId, setSelectedId] = useState("social-resource");
  const selected = wellbeingDimensions.find((dimension) => dimension.id === selectedId) ?? wellbeingDimensions[0];

  return (
    <section className="stone-map-layout">
      <div className="stone-map-panel" aria-label="מפת אבנים לפי מרכיבי שלומות">
        {wellbeingDimensions.map((dimension) => (
          <StoneButton
            key={dimension.id}
            dimension={dimension}
            selected={dimension.id === selected.id}
            onSelect={() => setSelectedId(dimension.id)}
          />
        ))}
      </div>

      <aside className="stone-detail-panel">
        <div className="panel-kicker">
          <MousePointer2 size={16} aria-hidden="true" />
          אבן נבחרת
        </div>
        <h2>{selected.label}</h2>
        <p>{selected.subtitle}</p>
        <StatusBadge status={selected.status} />
        <div className="score-line">
          <strong>{selected.score}</strong>
          <span>ציון ממד</span>
        </div>
        <p>{selected.summary[0]}</p>
        {selected.id === "social-resource" ? (
          <Link className="primary-button" href={`/dashboard/${selected.id}`}>
            פתיחת פירוט מלא
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span className="quiet-note">בדמו הפירוט המלא מוצג עבור משאב חברתי.</span>
        )}
      </aside>
    </section>
  );
}

function StoneButton({
  dimension,
  selected,
  onSelect,
}: {
  dimension: WellbeingDimension;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`stone-button stone-${dimension.status}${selected ? " selected" : ""}`}
      style={
        {
          "--stone-top": dimension.mapPosition.top,
          "--stone-right": dimension.mapPosition.right,
          "--stone-size": dimension.mapPosition.size,
          "--stone-rotate": `${dimension.mapPosition.rotate}deg`,
          "--stone-label-rotate": `${dimension.mapPosition.rotate * -1}deg`,
        } as CSSProperties
      }
      onClick={onSelect}
      aria-label={`${dimension.label}, ${statusLabels[dimension.status]}, ציון ${dimension.score}`}
    >
      <span>{dimension.label}</span>
      <small>{dimension.score}</small>
    </button>
  );
}
