"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, ShieldCheck, X } from "lucide-react";
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
  const [prevQuestionKey, setPrevQuestionKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [id, setId] = useState("");
  const [required, setRequired] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentKey = question ? question.draftKey : null;
  if (currentKey !== prevQuestionKey) {
    setPrevQuestionKey(currentKey);
    if (question) {
      setText(question.text);
      setDimensionId(question.dimensionId);
      setId(question.id);
      setRequired(question.required);
      setEnabled(question.enabled);
      setValidationError(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const dialogRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !question) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setValidationError("יש להזין נוסח שאלה");
      return;
    }
    if (!id.trim()) {
      setValidationError("יש להזין מזהה קבוע לשאלה");
      return;
    }
    setValidationError(null);
    onSave(question.draftKey, (current) => ({
      ...current,
      text: text.trim(),
      dimensionId: dimensionId as BuilderQuestion["dimensionId"],
      id: id.trim(),
      required,
      enabled,
    }));
    onClose();
  };

  const selectedDimension = wellbeingDimensions.find((d) => d.id === dimensionId);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dialog-title"
      ref={dialogRef}
    >
      <div className="modal-panel bg-stone-50 border border-stone-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h2 id="edit-dialog-title" className="text-lg font-bold text-stone-800">
            עריכת שאלה {questionIndex > 0 ? questionIndex : "(ללא מספר)"}
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

        {validationError ? (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl" role="alert">
            {validationError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              נוסח השאלה המדויק
            </label>
            <textarea
              rows={3}
              required
              className="w-full p-3 border border-stone-300 rounded-xl bg-white text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (validationError) setValidationError(null);
              }}
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
                onChange={(e) => {
                  setId(e.target.value);
                  if (validationError) setValidationError(null);
                }}
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

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 flex items-center gap-1.5"
            >
              <Eye size={14} aria-hidden="true" />
              {showPreview ? "הסתר תצוגה מקדימה" : "תצוגה מקדימה למשיב"}
            </button>
            {showPreview ? (
              <div className="mt-2 p-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-800 text-sm space-y-2" dir="rtl">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>ממד: {selectedDimension?.conceptLabel || dimensionId}</span>
                  <span>{required ? "חובה" : "רשות"}</span>
                </div>
                <p className="font-medium text-stone-900">{text || "(טרם הוזן נוסח שאלה)"}</p>
                <div className="flex justify-between items-center gap-1 text-xs text-stone-500 pt-1">
                  <span>לא מסכים כלל (1)</span>
                  <span>מסכים במידה רבה מאוד (6)</span>
                </div>
              </div>
            ) : null}
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
