import { useState } from "react";
import { Repeat } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { TimeBlockId, RecurringTemplateId } from "../../db/schema";
import {
  triggerRoutineGeneration,
  deleteFutureBlocksForTemplate,
} from "../../hooks/useRoutineGenerator";
import * as Evolu from "@evolu/common";
import { minutesToHHMM } from "../../lib/time";

type Recurrence = "daily" | "weekdays" | "custom";
const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

interface RepeatSectionProps {
  blockId: TimeBlockId;
  recurringTemplateId?: RecurringTemplateId | null;
  startMinutes: number;
  endMinutes: number;
  blockTitle: string;
  onClose: () => void;
}

export default function TimeBlockRepeatSection({
  blockId,
  recurringTemplateId,
  startMinutes,
  endMinutes,
  blockTitle,
  onClose,
}: RepeatSectionProps) {
  const { insert, update } = useEvolu();
  const [showRepeatForm, setShowRepeatForm] = useState(false);
  const [repeatRecurrence, setRepeatRecurrence] = useState<Recurrence>("daily");
  const [repeatDays, setRepeatDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [repeatFixed, setRepeatFixed] = useState(true);

  function handleCreateTemplate() {
    const dur = Math.max(15, endMinutes - startMinutes);
    const recurrenceDays =
      repeatRecurrence === "custom" ? JSON.stringify(repeatDays) : null;
    const result = insert("recurringTemplate", {
      title: Evolu.NonEmptyString1000.orThrow(blockTitle.trim() || "Rutina"),
      duration_minutes: dur as unknown as Evolu.PositiveInt,
      recurrence: Evolu.NonEmptyString100.orThrow(repeatRecurrence),
      recurrence_days: recurrenceDays
        ? Evolu.String1000.orThrow(recurrenceDays)
        : null,
      preferred_time: Evolu.NonEmptyString100.orThrow(
        minutesToHHMM(startMinutes),
      ),
      is_fixed_time: (repeatFixed ? 1 : 0) as Evolu.SqliteBoolean,
      energy: Evolu.NonEmptyString100.orThrow("normal"),
      active: 1 as Evolu.SqliteBoolean,
      source_calendar_id: null,
      source_event_uid: null,
    });
    if (result.ok) {
      update(
        "timeBlock",
        { id: blockId, recurring_template_id: result.value.id },
        { onComplete: triggerRoutineGeneration },
      );
    }
    setShowRepeatForm(false);
    onClose();
  }

  if (recurringTemplateId) {
    return (
      <div className="border-t border-ink/8 pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-ink/40">
          <Repeat size={10} />
          Recurring block
        </div>
        <button
          tabIndex={-1}
          onClick={() => {
            update("timeBlock", { id: blockId, recurring_template_id: null });
            update(
              "recurringTemplate",
              {
                id: recurringTemplateId,
                active: 0 as Evolu.SqliteBoolean,
              },
              {
                onComplete: () =>
                  deleteFutureBlocksForTemplate(recurringTemplateId),
              },
            );
            onClose();
          }}
          className="text-[10px] text-ink/40 hover:text-ink/70 transition-colors"
        >
          Zastavit trvale
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-ink/8 pt-2">
      {!showRepeatForm ? (
        <button
          tabIndex={-1}
          onClick={() => setShowRepeatForm(true)}
          className="flex items-center gap-1.5 text-xs text-ink/50 hover:text-ink/80 transition-colors"
        >
          <Repeat size={11} />
          Opakovat tento blok
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <Repeat size={11} className="text-ink/50 shrink-0" />
            <span className="text-[10px] font-medium text-ink/60 uppercase tracking-wide">
              Rutina
            </span>
          </div>

          <div className="flex gap-1">
            {(["daily", "weekdays", "custom"] as Recurrence[]).map((r) => (
              <button
                key={r}
                tabIndex={-1}
                onClick={() => setRepeatRecurrence(r)}
                className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                  repeatRecurrence === r
                    ? "bg-ink text-paper"
                    : "bg-ink/8 text-ink/60 hover:bg-ink/15"
                }`}
              >
                {r === "daily"
                  ? "Každý den"
                  : r === "weekdays"
                    ? "Prac. dny"
                    : "Vlastní"}
              </button>
            ))}
          </div>

          {repeatRecurrence === "custom" && (
            <div className="flex gap-0.5">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  tabIndex={-1}
                  onClick={() =>
                    setRepeatDays((prev) =>
                      prev.includes(i)
                        ? prev.filter((d) => d !== i)
                        : [...prev, i],
                    )
                  }
                  className={`flex-1 text-[10px] py-0.5 rounded transition-colors ${
                    repeatDays.includes(i)
                      ? "bg-ink text-paper"
                      : "bg-ink/8 text-ink/50 hover:bg-ink/15"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1">
            <button
              tabIndex={-1}
              onClick={() => setRepeatFixed(true)}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                repeatFixed
                  ? "bg-ink text-paper"
                  : "bg-ink/8 text-ink/60 hover:bg-ink/15"
              }`}
            >
              Pevný čas
            </button>
            <button
              tabIndex={-1}
              onClick={() => setRepeatFixed(false)}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                !repeatFixed
                  ? "bg-ink text-paper"
                  : "bg-ink/8 text-ink/60 hover:bg-ink/15"
              }`}
            >
              Flexibilní
            </button>
          </div>

          <div className="flex gap-1 pt-0.5">
            <button
              tabIndex={-1}
              onClick={() => setShowRepeatForm(false)}
              className="flex-1 text-[10px] py-1 rounded border border-ink/15 text-ink/50 hover:bg-ink/5 transition-colors"
            >
              Zrušit
            </button>
            <button
              tabIndex={-1}
              onClick={handleCreateTemplate}
              className="flex-1 text-[10px] py-1 rounded bg-ink text-paper hover:bg-ink/85 transition-colors"
            >
              Vytvořit rutinu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
