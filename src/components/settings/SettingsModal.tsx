import { useState, useEffect, useRef } from "react";
import { RefreshCw, Repeat } from "lucide-react";
import { Mnemonic } from "@evolu/common";
import * as Evolu from "@evolu/common";
import { useQuerySubscription } from "@evolu/react";
import { evolu, useEvolu, EVOLU_RELAY_KEY, DEFAULT_RELAY_URL } from "../../db/evolu";
import { RecurringTemplateId } from "../../db/schema";
import { getCorsProxy, setCorsProxy } from "../../services/calendarSync";
import { requestPermissionIfNeeded } from "../../hooks/useBlockTransitionNotifications";
import { NOTIFICATIONS_ENABLED_KEY, SHORTCUT_HINTS_KEY, SYNC_ENABLED_KEY } from "../../constants";
import { triggerRoutineGeneration, deleteFutureBlocksForTemplate } from "../../hooks/useRoutineGenerator";
import { useTimeFormat } from "../../contexts/TimeFormatContext";
import { useTheme } from "../../contexts/ThemeContext";
import { CalendarsSection } from "./CalendarsSection";

interface SettingsModalProps {
  onClose: () => void;
  syncErrors: Record<string, string>;
  highlightSync?: boolean;
}

const recurringTemplatesQuery = evolu.createQuery((db) =>
  db
    .selectFrom("recurringTemplate")
    .select(["id", "title", "recurrence", "recurrence_days", "preferred_time", "duration_minutes", "active"])
    .where("isDeleted", "is", null)
    .orderBy("title", "asc"),
);
evolu.loadQuery(recurringTemplatesQuery);

function formatRecurrence(recurrence: string | null, recurrenceDays: string | null): string {
  if (recurrence === "daily") return "Každý den";
  if (recurrence === "weekdays") return "Prac. dny";
  if (recurrence === "custom" && recurrenceDays) {
    try {
      const days = JSON.parse(recurrenceDays) as number[];
      const labels = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
      return days.map((d) => labels[d]).join(", ");
    } catch { return "Vlastní"; }
  }
  return "—";
}

const INPUT_CLS = "w-full text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40";

export default function SettingsModal({ onClose, syncErrors, highlightSync }: SettingsModalProps) {
  const { update } = useEvolu();

  // --- Identity section ---
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    evolu.appOwner.then((owner) => {
      setOwnerId(owner.id);
      setMnemonic(owner.mnemonic ?? null);
    });
  }, []);

  // Refresh recurring templates on mount (cache may be stale if modal was closed during mutations)
  useEffect(() => {
    evolu.loadQuery(recurringTemplatesQuery);
  }, []);

  function handleCopy() {
    if (!mnemonic) return;
    navigator.clipboard.writeText(mnemonic).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleImport() {
    const parsed = Mnemonic.from(importValue.trim());
    if (!parsed.ok) { setImportError("Neplatný formát klíče. Zkontroluj 24 slov."); return; }
    await evolu.restoreAppOwner(parsed.value);
  }

  const shortId = ownerId ? `${ownerId.slice(0, 8)}…${ownerId.slice(-4)}` : "…";

  // --- Recurring templates section ---
  const recurringTemplateRows = useQuerySubscription(recurringTemplatesQuery);

  // Sync section highlight
  const syncSectionRef = useRef<HTMLElement>(null);
  const [syncHighlighted, setSyncHighlighted] = useState(false);

  useEffect(() => {
    if (!highlightSync) return;
    const el = syncSectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setSyncHighlighted(true);
    const t = setTimeout(() => setSyncHighlighted(false), 2000);
    return () => clearTimeout(t);
  }, [highlightSync]);

  const [relayUrlValue, setRelayUrlValue] = useState(
    () => localStorage.getItem(EVOLU_RELAY_KEY) || DEFAULT_RELAY_URL,
  );
  const [relaySaved, setRelaySaved] = useState(false);
  const [relayUrlError, setRelayUrlError] = useState<string | null>(null);
  const [relayStatus, setRelayStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  useEffect(() => {
    const trimmed = relayUrlValue.trim();
    if (!trimmed || (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://"))) {
      setRelayStatus("idle");
      return;
    }
    let ws: WebSocket | null = null;
    const debounce = setTimeout(() => {
      setRelayStatus("checking");
      let settled = false;
      const done = (status: "ok" | "error") => {
        if (settled) return;
        settled = true;
        ws?.close();
        setRelayStatus(status);
      };
      try {
        ws = new WebSocket(trimmed);
        const timeout = setTimeout(() => done("error"), 5000);
        ws.onopen = () => { clearTimeout(timeout); done("ok"); };
        ws.onerror = () => { clearTimeout(timeout); done("error"); };
      } catch {
        done("error");
      }
    }, 500);
    return () => { clearTimeout(debounce); ws?.close(); };
  }, [relayUrlValue]);

  function handleSaveRelay() {
    const val = relayUrlValue.trim();
    if (val && !val.startsWith("ws://") && !val.startsWith("wss://")) {
      setRelayUrlError("URL musí začínat wss:// nebo ws://");
      return;
    }
    setRelayUrlError(null);
    if (val && val !== DEFAULT_RELAY_URL) {
      localStorage.setItem(EVOLU_RELAY_KEY, val);
    } else {
      localStorage.removeItem(EVOLU_RELAY_KEY);
    }
    setRelaySaved(true);
    setTimeout(() => window.location.reload(), 800);
  }

  const [shortcutHints, setShortcutHints] = useState(
    () => localStorage.getItem(SHORTCUT_HINTS_KEY) !== "false",
  );

  function handleHintsToggle() {
    const next = !shortcutHints;
    setShortcutHints(next);
    localStorage.setItem(SHORTCUT_HINTS_KEY, String(next));
  }

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  async function handleResetData() {
    await evolu.resetAppOwner();
  }

  const [corsProxy, setCorsProxyState] = useState(() => getCorsProxy());
  const { timeFormat, setTimeFormat } = useTimeFormat();
  const { theme, setTheme } = useTheme();

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "true",
  );
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => ("Notification" in window ? Notification.permission : "unsupported"),
  );

  // Sync
  const [syncEnabled, setSyncEnabled] = useState(
    () => localStorage.getItem(SYNC_ENABLED_KEY) === "true",
  );

  function handleSyncToggle() {
    const next = !syncEnabled;
    setSyncEnabled(next);
    if (next) {
      localStorage.setItem(SYNC_ENABLED_KEY, "true");
    } else {
      localStorage.removeItem(SYNC_ENABLED_KEY);
    }
    setTimeout(() => window.location.reload(), 300);
  }

  async function handleNotifToggle() {
    if (notificationsEnabled) {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
      setNotificationsEnabled(false);
      return;
    }
    const granted = await requestPermissionIfNeeded();
    setNotifPermission("Notification" in window ? Notification.permission : "unsupported");
    if (granted) {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      setNotificationsEnabled(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-ink/20 rounded-xl shadow-xl w-[520px] max-w-[95vw] p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Nastavení</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">✕</button>
        </div>

        {/* === Identity section === */}
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Identita (Evolu)</h3>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-ink/60">Owner ID:</span>
            <code className="text-sm font-mono bg-ink/5 px-2 py-0.5 rounded">{shortId}</code>
          </div>

          {!showMnemonic ? (
            <button onClick={() => setShowMnemonic(true)} className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors mr-2 mb-2">
              Zobrazit owner key
            </button>
          ) : (
            <div className="mb-4">
              <p className="text-xs text-ink/50 mb-1">Tvůj owner key (24 slov) — nikomu nesdílej:</p>
              <code className="block text-xs font-mono bg-ink/5 p-3 rounded-lg leading-relaxed break-words">
                {mnemonic ?? "načítání…"}
              </code>
              <button onClick={handleCopy} className="mt-2 text-xs px-3 py-1 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors">
                {copied ? "Zkopírováno!" : "Kopírovat"}
              </button>
            </div>
          )}

          {!showImport ? (
            <button onClick={() => setShowImport(true)} className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors">
              Importovat owner key
            </button>
          ) : (
            <div className="mt-1">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                Importování jiného klíče přepíše lokální identitu. Data se obnoví ze sync serveru.
              </p>
              <textarea
                value={importValue}
                onChange={(e) => { setImportValue(e.target.value); setImportError(null); }}
                placeholder="Vlož 24 slov owner key…"
                className="w-full text-xs font-mono bg-ink/5 border border-ink/20 rounded-lg p-2 resize-none h-20 focus:outline-none focus:border-ink/40"
              />
              {importError && <p className="text-xs text-red-600 mt-1">{importError}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={handleImport} disabled={!importValue.trim()} className="text-sm px-3 py-1.5 bg-ink text-paper rounded-lg hover:bg-ink/80 disabled:opacity-40 transition-colors">
                  Importovat
                </button>
                <button onClick={() => { setShowImport(false); setImportValue(""); setImportError(null); }} className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors">
                  Zrušit
                </button>
              </div>
            </div>
          )}
        </section>

        {/* === Calendars section === */}
        <CalendarsSection syncErrors={syncErrors} />

        {/* === Recurring Blocks section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Recurring Blocks</h3>
          {recurringTemplateRows.length === 0 ? (
            <p className="text-sm text-ink/40">Žádné šablony. Vytvoř recurring block přes detail time-blocku.</p>
          ) : (
            <ul className="space-y-2">
              {recurringTemplateRows.map((t) => {
                const tid = t.id as RecurringTemplateId;
                const isActive = (t.active as number | null) === 1;
                const recurrenceLabel = formatRecurrence(t.recurrence as string | null, t.recurrence_days as string | null);
                const time = t.preferred_time as string | null;
                const dur = t.duration_minutes as number | null;
                return (
                  <li key={tid} className={`flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-ink/5 group ${!isActive ? "opacity-50" : ""}`}>
                    <Repeat size={13} className="shrink-0 text-ink/40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title as string ?? "—"}</p>
                      <p className="text-[10px] text-ink/40">
                        {recurrenceLabel}
                        {time ? ` · ${time}` : ""}
                        {dur ? ` · ${dur} min` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => { update("recurringTemplate", { id: tid, active: (isActive ? 0 : 1) as Evolu.SqliteBoolean }, { onComplete: () => { evolu.loadQuery(recurringTemplatesQuery); if (!isActive) triggerRoutineGeneration(); } }); }}
                      className="text-xs text-ink/50 hover:text-ink transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      title={isActive ? "Vypnout" : "Zapnout"}
                    >
                      {isActive ? "Vypnout" : "Zapnout"}
                    </button>
                    <button
                      onClick={() => { update("recurringTemplate", { id: tid, isDeleted: 1 }, { onComplete: () => { evolu.loadQuery(recurringTemplatesQuery); deleteFutureBlocksForTemplate(tid); } }); }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      Smazat
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* === Appearance section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Vzhled</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink/80">Formát času</p>
              <p className="text-xs text-ink/40 mt-0.5">Platí pro všechna časová zobrazení v aplikaci.</p>
            </div>
            <div className="flex rounded-lg border border-ink/15 overflow-hidden shrink-0">
              {(["24h", "12h"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFormat(f)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    timeFormat === f
                      ? "bg-ink text-paper"
                      : "bg-transparent text-ink/50 hover:bg-ink/5"
                  }`}
                >
                  {f === "24h" ? "24h" : "AM/PM"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <p className="text-sm text-ink/80">Barevné schéma</p>
              <p className="text-xs text-ink/40 mt-0.5">Platí okamžitě, uloženo v prohlížeči.</p>
            </div>
            <div className="flex rounded-lg border border-ink/15 overflow-hidden shrink-0">
              {(["light", "system", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    theme === t
                      ? "bg-ink text-paper"
                      : "bg-transparent text-ink/50 hover:bg-ink/5"
                  }`}
                >
                  {t === "light" ? "Světlý" : t === "dark" ? "Tmavý" : "Systém"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* === Planning section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Plánování</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink/80">Zkratkové hinty</p>
              <p className="text-xs text-ink/40 mt-0.5">Zobrazit klávesové zkratky u tlačítek (např. Del, Ctrl+↵).</p>
            </div>
            <button
              onClick={handleHintsToggle}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${shortcutHints ? "bg-ink" : "bg-ink/20"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow transition-all ${shortcutHints ? "left-5" : "left-1"}`} />
            </button>
          </div>
        </section>

        {/* === Notifications section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Oznámení</h3>
          {notifPermission === "unsupported" ? (
            <p className="text-sm text-ink/40">Notifikace nejsou v tomto prohlížeči podporovány.</p>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink/80">Připomenutí přechodů mezi bloky</p>
                <p className="text-xs text-ink/40 mt-0.5">
                  Upozornění 5 minut před koncem time-blocku.
                  {notifPermission === "denied" && (
                    <span className="text-red-500 ml-1">Notifikace jsou zakázány v prohlížeči.</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleNotifToggle}
                disabled={notifPermission === "denied"}
                className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
                  notificationsEnabled ? "bg-ink" : "bg-ink/20"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow transition-all ${
                    notificationsEnabled ? "left-5" : "left-1"
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        {/* === Sync section === */}
        <section ref={syncSectionRef} className={`mt-6 rounded-lg transition-all duration-300 ${syncHighlighted ? "ring-2 ring-ink/30 bg-ink/3 px-3 py-2 -mx-3" : ""}`}>
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Synchronizace</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink/80">Povolit sync</p>
              <p className="text-xs text-ink/40 mt-0.5 leading-relaxed">
                Synchronizace mezi zařízeními přes Evolu relay — open-source, E2E šifrovaný server. Výchozí relay je zdarma. Změna vyžaduje restart.
              </p>
            </div>
            <button
              onClick={handleSyncToggle}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${syncEnabled ? "bg-ink" : "bg-ink/20"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-surface shadow transition-all ${syncEnabled ? "left-5" : "left-1"}`} />
            </button>
          </div>
        </section>

        {/* === Advanced section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Pokročilé</h3>

          {/* Relay URL */}
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-ink/70">Evolu relay URL</label>
            {relayStatus === "checking" && (
              <span className="text-xs text-ink/40 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Kontroluji…
              </span>
            )}
            {relayStatus === "ok" && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Dostupné
              </span>
            )}
            {relayStatus === "error" && (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Nedostupné
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={relayUrlValue}
              onChange={(e) => { setRelayUrlValue(e.target.value); setRelaySaved(false); setRelayUrlError(null); }}
              placeholder={DEFAULT_RELAY_URL}
              className={`flex-1 text-sm bg-ink/5 border rounded-lg px-3 py-1.5 focus:outline-none font-mono ${relayUrlError ? "border-red-400 focus:border-red-500" : "border-ink/20 focus:border-ink/40"}`}
            />
            <button
              onClick={handleSaveRelay}
              disabled={relaySaved}
              className="text-sm px-3 py-1.5 bg-ink text-paper rounded-lg hover:bg-ink/80 disabled:opacity-50 transition-colors shrink-0"
            >
              {relaySaved ? "Restartuji…" : "Uložit"}
            </button>
          </div>
          {relayUrlError && <p className="text-xs text-red-500 mt-1">{relayUrlError}</p>}
          <p className="text-xs text-ink/40 mt-1 mb-4">
            Změna relay URL odpojí synchronizaci s předchozím serverem. Aplikace se po uložení restartuje.
            Prázdné pole = výchozí <code className="font-mono">free.evoluhq.com</code>.
          </p>

          <label className="block text-sm text-ink/70 mb-1">CORS proxy URL</label>
          <input
            type="url"
            value={corsProxy}
            onChange={(e) => { setCorsProxyState(e.target.value); setCorsProxy(e.target.value); }}
            placeholder="https://corsproxy.io/?url="
            className={`${INPUT_CLS} font-mono`}
          />
          <p className="text-xs text-ink/40 mt-1">
            Pokud ICS sync selže kvůli CORS, nastav proxy která přidá potřebné hlavičky. Hodnota se přidá před URL kalendáře.{" "}
            <a href="https://corsproxy.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink/60">corsproxy.io</a>{" "}
            je zdarma dostupná varianta.
          </p>

          {/* Reset data */}
          <div className="mt-6 pt-4 border-t border-ink/10">
            {!showResetConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink/80">Smazat lokální data</p>
                  <p className="text-xs text-ink/40 mt-0.5">Smaže lokální data a vytvoří novou identitu. Data na sync serveru zůstanou nedešifrovatelná.</p>
                </div>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="text-sm px-3 py-1.5 border border-red-300 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                >
                  Smazat data
                </button>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Opravdu smazat všechna data?</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-3">
                  Tato akce je nevratná. Smažou se všechny lokální úkoly, time-bloky, poznámky a kalendáře. Vytvoří se nová identita. Data na sync serveru zůstanou nedešifrovatelná.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetData}
                    className="text-sm px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Smazat
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
