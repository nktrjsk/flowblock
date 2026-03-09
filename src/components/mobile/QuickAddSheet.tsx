import { useRef, useEffect, useState } from "react";
import { useEvolu } from "../../db/evolu";
import * as Evolu from "@evolu/common";

interface QuickAddSheetProps {
  onClose: () => void;
}

export default function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { insert } = useEvolu();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function save() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const result = Evolu.NonEmptyString1000.from(trimmed);
    if (!result.ok) return;
    insert("task", {
      title: result.value,
      status: Evolu.NonEmptyString100.orThrow("inbox"),
      priority: Evolu.NonEmptyString100.orThrow("none"),
      energy: Evolu.NonEmptyString100.orThrow("normal"),
    });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    else if (e.key === "Escape") onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#f5f0e8] rounded-t-2xl shadow-xl px-4 pt-4 pb-8 safe-area-bottom">
        <div className="w-10 h-1 rounded-full bg-[#1a1a2e]/20 mx-auto mb-4" />
        <p className="text-xs font-semibold uppercase tracking-wider text-[#1a1a2e]/40 mb-2">
          Nový úkol
        </p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Název úkolu…"
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#1a1a2e]/20 bg-white outline-none focus:border-[#1a1a2e]/50"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm rounded-xl border border-[#1a1a2e]/20 text-[#1a1a2e]/60"
          >
            Zrušit
          </button>
          <button
            onClick={save}
            disabled={!value.trim()}
            className="flex-1 py-2.5 text-sm rounded-xl bg-[#1a1a2e] text-[#f5f0e8] font-medium disabled:opacity-40"
          >
            Přidat
          </button>
        </div>
      </div>
    </>
  );
}
