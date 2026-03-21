import { useEvolu } from "../db/evolu";
import * as Evolu from "@evolu/common";

export const TASK_PREFIX = "//";

export function useQuickAdd() {
  const { insert } = useEvolu();

  /** Returns true if the value was valid and inserted, false otherwise. */
  function submit(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;

    if (trimmed.startsWith(TASK_PREFIX)) {
      const title = trimmed.slice(TASK_PREFIX.length).trim();
      if (!title) return false;
      const result = Evolu.NonEmptyString1000.from(title);
      if (!result.ok) return false;
      insert("task", {
        title: result.value,
        status: Evolu.NonEmptyString100.orThrow("inbox"),
        priority: Evolu.NonEmptyString100.orThrow("none"),
        energy: Evolu.NonEmptyString100.orThrow("normal"),
      });
    } else {
      const result = Evolu.NonEmptyString1000.from(trimmed);
      if (!result.ok) return false;
      insert("note", {
        content: result.value,
        status: Evolu.NonEmptyString100.orThrow("new"),
        converted_task_id: null,
      });
    }

    return true;
  }

  return { submit };
}
