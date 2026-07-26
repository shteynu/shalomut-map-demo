"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { wellbeingDimensions } from "@/lib/demo-data";
import type { BuilderQuestion } from "./types";

type QuestionEditDialogProps = {
  isOpen: boolean;
  question: BuilderQuestion | null;
  questionIndex: number;
  onClose: () => void;
  onSave: (draftKey: string, updater: (q: BuilderQuestion) => BuilderQuestion) => void;
};

export function QuestionEditDialog({
  isOpen,
  question,
  questionIndex,
  onClose,
  onSave,
}: QuestionEditDialogProps) {
  const [text, setText] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [id, setId] = useState("");
  const [required, setRequired] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (question) {
      setText(question.text);
      setDimensionId(question.dimensionId);
      setId(question.id);
      setRequired(question.required);
      setEnabled(question.enabled);
    }
  }, [question]);

  if (!isOpen || !question) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(question.draftKey, (current) => ({
      ...current,
      text,
      dimensionId: dimensionId as BuilderQuestion["dimensionId"],
      id,
      required,
      enabled,
    }));
    onClose();
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dialog-title"
    >
      <div className="modal-panel bg-stone-50 border border-stone-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 id="edit-dialog-title" className="text-lg font-bold text-stone-800">
            עריכת שאלה {questionIndex}
          </h2>
          <button
            type="button"
            className="p-1 text-stone-500 hover:text-stone-800 rounded-lg"
            onClick={onClose}
            aria-label="סגירה"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              נוסח השאלה המדויק
            </label>
            <textarea
              rows={4}
              required
              className="w-full p-3 border border-stone-300 rounded-xl bg-white text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              dir="rtl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                ממד שלומות
              </label>
              <select
                className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none"
                value={dimensionId}
                onChange={(e) => setDimensionId(e.target.value)}
              >
                {wellbeingDimensions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.conceptLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                מזהה קבוע
              </label>
              <input
                type="text"
                dir="ltr"
                required
                className="w-full p-2.5 border border-stone-300 rounded-xl bg-white text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-800">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              שאלת חובה
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-800">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              שאלה פעילה
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 rounded-xl"
              onClick={onClose}
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Check size={16} aria-hidden="true" />
              שמירה
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
