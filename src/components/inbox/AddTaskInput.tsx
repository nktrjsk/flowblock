import { useState, useRef, useEffect } from "react";
import { useQuickAdd, NOTE_PREFIX } from "../../hooks/useQuickAdd";

export default function AddTaskInput() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { submit } = useQuickAdd();

  const isNote = value.startsWith(NOTE_PREFIX);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (submit(value)) {
        setValue("");
        setOpen(false);
      }
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
        + Přidat
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setValue("");
          setOpen(false);
        }}
        placeholder={isNote ? "Rychlá poznámka…" : "Název úkolu… (// = poznámka)"}
        className={`w-full py-2 px-3 text-sm border rounded-lg bg-surface outline-none focus:border-ink/50 transition-colors ${
          isNote ? "border-ink/40 text-ink/60" : "border-ink/20"
        }`}
      />
    </div>
  );
}
