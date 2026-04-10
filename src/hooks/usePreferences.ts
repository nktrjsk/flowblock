import { useEvolu, evolu } from "../db/evolu";
import { useQuerySubscription } from "@evolu/react";
import * as Evolu from "@evolu/common";
import { PreferencesId } from "../db/schema";
import type { TimeFormat } from "../contexts/TimeFormatContext";

const preferencesQuery = evolu.createQuery((db) =>
  db.selectFrom("preferences").selectAll().where("isDeleted", "is", null),
);
evolu.loadQuery(preferencesQuery);

// One-time migration from localStorage on first launch
evolu.loadQuery(preferencesQuery).then((rows) => {
  if (rows.length > 0) return;
  const storedFormat = localStorage.getItem("flowblock_time_format") as TimeFormat | null;
  const storedHints = localStorage.getItem("flowblock_shortcut_hints");
  const storedProxy = localStorage.getItem("flowblock_cors_proxy");
  evolu.insert("preferences", {
    time_format: Evolu.NonEmptyString100.orThrow(storedFormat ?? "24h"),
    shortcut_hints: (storedHints !== "false" ? 1 : 0) as Evolu.SqliteBoolean,
    cors_proxy: storedProxy ? Evolu.String1000.orThrow(storedProxy.slice(0, 999)) : null,
  });
  localStorage.removeItem("flowblock_time_format");
  localStorage.removeItem("flowblock_shortcut_hints");
  localStorage.removeItem("flowblock_cors_proxy");
});

export function usePreferences() {
  const { update } = useEvolu();
  const rows = useQuerySubscription(preferencesQuery);
  const prefs = rows[0] ?? null;

  const timeFormat = ((prefs?.time_format as string | null) ?? "24h") as TimeFormat;
  const shortcutHints = (prefs?.shortcut_hints as number | null) !== 0;
  const corsProxy = (prefs?.cors_proxy as string | null) ?? "";

  function setTimeFormat(format: TimeFormat) {
    if (!prefs) return;
    update("preferences", {
      id: prefs.id as PreferencesId,
      time_format: Evolu.NonEmptyString100.orThrow(format),
    });
  }

  function setShortcutHints(enabled: boolean) {
    if (!prefs) return;
    update("preferences", {
      id: prefs.id as PreferencesId,
      shortcut_hints: (enabled ? 1 : 0) as Evolu.SqliteBoolean,
    });
  }

  function setCorsProxy(value: string) {
    if (!prefs) return;
    const trimmed = value.trim();
    update("preferences", {
      id: prefs.id as PreferencesId,
      cors_proxy: trimmed ? Evolu.String1000.orThrow(trimmed.slice(0, 999)) : null,
    });
  }

  return { timeFormat, shortcutHints, corsProxy, setTimeFormat, setShortcutHints, setCorsProxy };
}
