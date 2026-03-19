import { useRef, useEffect, useState } from "react";
import { useQuickAdd, NOTE_PREFIX } from "../../hooks/useQuickAdd";

interface QuickAddSheetProps {
  onClose: () => void;
}

export default function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { submit } = useQuickAdd();

  const isNote = value.startsWith(NOTE_PREFIX);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (submit(value)) onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    else if (e.key === "Escape") onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-paper rounded-t-2xl shadow-xl px-4 pt-4 pb-8 safe-area-bottom">
        <div className="w-10 h-1 rounded-full bg-ink/20 mx-auto mb-4" />
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40 mb-2">
          {isNote ? "Nová poznámka" : "Nový úkol"}
        </p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isNote ? "Rychlá poznámka…" : "Název úkolu… (// = poznámka)"}
          className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-surface outline-none focus:border-ink/50 transition-colors ${
            isNote ? "border-ink/40 text-ink/60" : "border-ink/20"
          }`}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl border border-ink/20 text-ink/60"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex-1 py-2.5 text-sm rounded-xl bg-ink text-paper font-medium disabled:opacity-40"
          >
            Přidat
          </button>
        </div>
      </div>
    </>
  );
}
