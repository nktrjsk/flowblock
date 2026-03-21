import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { useQuickAdd, TASK_PREFIX } from "../../hooks/useQuickAdd";
import * as Evolu from "@evolu/common";

export const WELCOME_DISMISSED_KEY = "flowblock_welcome_dismissed";

interface WelcomeCardProps {
  onDismiss: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

function buildDemoDate(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export default function WelcomeCard({ onDismiss, onOpenHelp, onOpenSettings }: WelcomeCardProps) {
  const { insert } = useEvolu();
  const { submit } = useQuickAdd();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isTask = value.startsWith(TASK_PREFIX);

  function handleDismiss() {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    onDismiss();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (submit(value)) {
        localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
        onDismiss();
      }
    } else if (e.key === "Escape") {
      handleDismiss();
    }
  }

  function handleLoadDemo() {
    const tasks = [
      { title: "Odpovědět Martinovi na nabídku", priority: "high", energy: "draining" },
      { title: "Koupit dárek pro Lucii", priority: "medium", energy: "normal" },
      { title: "Přečíst článek o produktivitě", priority: "low", energy: "lite" },
      { title: "Zavolat zubařovi", priority: "none", energy: "normal" },
      { title: "Nákup — mléko, chléb, káva", priority: "none", energy: "lite" },
    ] as const;

    for (const t of tasks) {
      insert("task", {
        title: Evolu.NonEmptyString1000.orThrow(t.title),
        status: Evolu.NonEmptyString100.orThrow("inbox"),
        priority: Evolu.NonEmptyString100.orThrow(t.priority),
        energy: Evolu.NonEmptyString100.orThrow(t.energy),
      });
    }

    insert("timeBlock", {
      task_id: null,
      title: Evolu.NonEmptyString1000.orThrow("Odpovědět Martinovi na nabídku"),
      start: Evolu.NonEmptyString100.orThrow(buildDemoDate(9, 0)),
      end: Evolu.NonEmptyString100.orThrow(buildDemoDate(10, 0)),
      priority: Evolu.NonEmptyString100.orThrow("high"),
    });
    insert("timeBlock", {
      task_id: null,
      title: Evolu.NonEmptyString1000.orThrow("Administrativa"),
      start: Evolu.NonEmptyString100.orThrow(buildDemoDate(10, 30)),
      end: Evolu.NonEmptyString100.orThrow(buildDemoDate(11, 0)),
      priority: Evolu.NonEmptyString100.orThrow("medium"),
    });
    insert("timeBlock", {
      task_id: null,
      title: Evolu.NonEmptyString1000.orThrow("Přečíst článek o produktivitě"),
      start: Evolu.NonEmptyString100.orThrow(buildDemoDate(14, 0)),
      end: Evolu.NonEmptyString100.orThrow(buildDemoDate(14, 30)),
      priority: Evolu.NonEmptyString100.orThrow("low"),
    });

    localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    onDismiss();
  }

  return (
    <div
      className="mx-3 my-2 rounded-lg border border-ink/10 flex flex-col gap-3 p-4 relative"
      style={{
        background: "rgba(26,26,46,0.02)",
        boxShadow: "0 1px 4px rgba(26,26,46,0.06), 0 0 0 1px rgba(26,26,46,0.04)",
      }}
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded hover:bg-ink/8 text-ink/30 hover:text-ink/60 transition-colors"
        title="Zavřít"
      >
        <X size={13} />
      </button>

      {/* Heading */}
      <div>
        <p className="font-serif italic text-base text-ink leading-snug">
          Sem patří vše,<br />co ti teď leží v hlavě.
        </p>
        <p className="text-xs text-ink/50 mt-1.5 leading-relaxed">
          Napiš úkol, přetáhni ho do kalendáře<br />a máš plán. Tak jednoduché to je.
        </p>
      </div>

      {/* Inline task input */}
      <div className="relative">
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isTask ? "Název prvního úkolu…" : "Rychlá poznámka… (// = úkol)"}
          className={`w-full py-2 px-3 pr-14 text-sm rounded-lg border bg-surface outline-none transition-colors ${
            isTask
              ? "border-ink/20 focus:border-ink/50"
              : "border-ink/30 text-ink/60 focus:border-ink/50"
          }`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink/25 pointer-events-none">
          Enter →
        </span>
      </div>

      {/* Secondary CTA */}
      <button
        onClick={handleLoadDemo}
        className="text-xs text-ink/50 hover:text-ink/80 transition-colors text-center"
      >
        nebo <span className="font-semibold">načíst ukázkový den</span>
      </button>

      {/* Divider */}
      <div className="border-t border-dashed border-ink/15" />

      {/* Privacy note + help link */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] text-ink/35 leading-relaxed">
          Data zůstávají v tvém prohlížeči, případně lze{" "}
          <button
            onClick={onOpenSettings}
            className="underline underline-offset-2 hover:text-ink/60 transition-colors"
          >
            zapnout synchronizaci
          </button>
          {" "}pomocí Evolu
          <span className="relative group/evolu inline-block ml-0.5 align-super">
            <span className="text-[9px] cursor-help text-ink/40">?</span>
            <span className="absolute bottom-full left-0 mb-1.5 w-56 bg-ink text-paper text-[10px] rounded-lg px-2.5 py-2 leading-relaxed opacity-0 pointer-events-none group-hover/evolu:opacity-100 transition-opacity z-50 shadow-lg">
              Evolu je open-source local-first databáze s volitelnou E2E šifrovanou synchronizací přes relay server. Žádný vendor lock-in.
            </span>
          </span>
          .
        </p>
        <button
          onClick={onOpenHelp}
          className="text-[10px] text-ink/35 hover:text-ink/60 underline underline-offset-2 transition-colors shrink-0"
        >
          Přehled funkcí
        </button>
      </div>
    </div>
  );
}
