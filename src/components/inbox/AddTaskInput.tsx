import { useState, useRef, useEffect } from "react";
import { useEvolu } from "../../db/evolu";
import * as Evolu from "@evolu/common";

export default function AddTaskInput() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { insert } = useEvolu();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (!trimmed) return;
      const titleResult = Evolu.NonEmptyString1000.from(trimmed);
      if (!titleResult.ok) return;
      insert("task", {
        title: titleResult.value,
        status: Evolu.NonEmptyString100.orThrow("inbox"),
        priority: Evolu.NonEmptyString100.orThrow("none"),
        energy: Evolu.NonEmptyString100.orThrow("normal"),
      });
      setValue("");
      setOpen(false);
    } else if (e.key === "Escape") {
      setValue("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2 px-3 text-sm text-ink/50 hover:text-ink hover:bg-ink/5 rounded-lg text-left transition-colors"
      >
        + Přidat úkol
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        setValue("");
        setOpen(false);
      }}
      placeholder="Název úkolu..."
      className="w-full py-2 px-3 text-sm border border-ink/20 rounded-lg bg-surface outline-none focus:border-ink/50"
    />
  );
}
