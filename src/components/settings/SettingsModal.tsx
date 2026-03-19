import { useState, useEffect, useRef } from "react";
import { RefreshCw, Pencil, X } from "lucide-react";
import { Mnemonic } from "@evolu/common";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu, EVOLU_RELAY_KEY, DEFAULT_RELAY_URL } from "../../db/evolu";
import { CalendarId } from "../../db/schema";
import { syncCalendar, getCorsProxy, setCorsProxy } from "../../services/calendarSync";
import { requestPermissionIfNeeded } from "../../hooks/useBlockTransitionNotifications";
import { NOTIFICATIONS_ENABLED_KEY, SHORTCUT_HINTS_KEY } from "../../constants";
import { useToast } from "../ui/Toast";
import { useTimeFormat } from "../../contexts/TimeFormatContext";
import { useTheme } from "../../contexts/ThemeContext";

interface SettingsModalProps {
  onClose: () => void;
  syncErrors: Record<string, string>;
  highlightSync?: boolean;
}

const calendarsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("calendar")
    .select(["id", "type", "url", "display_name", "color", "last_fetched_at", "username", "password"])
    .where("isDeleted", "is", null)
    .orderBy("display_name", "asc"),
);

const COLORS = ["#4f8ef7", "#e85d5d", "#4caf7a", "#e09b2f", "#9b59b6", "#1a1a2e"];

const INPUT_CLS = "w-full text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40";

export default function SettingsModal({ onClose, syncErrors, highlightSync }: SettingsModalProps) {
  const { insert, update } = useEvolu();
  const { show } = useToast();

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
    sessionStorage.setItem("evolu-restore-redirect", window.location.pathname);
    await evolu.restoreAppOwner(parsed.value);
  }

  const shortId = ownerId ? `${ownerId.slice(0, 8)}…${ownerId.slice(-4)}` : "…";

  // --- Calendars section ---
  const calendarRows = useQuery(calendarsQuery);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"ics" | "caldav">("ics");
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addColor, setAddColor] = useState(COLORS[0]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSyncing, setAddSyncing] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSyncing, setEditSyncing] = useState(false);

  // Per-calendar syncing + errors
  const [calSyncing, setCalSyncing] = useState<Record<string, boolean>>({});
  const [calErrors, setCalErrors] = useState<Record<string, string>>({});
  const mergedErrors: Record<string, string> = { ...syncErrors, ...calErrors };

  // Advanced
  const relaySectionRef = useRef<HTMLElement>(null);
  const [relayHighlighted, setRelayHighlighted] = useState(false);

  useEffect(() => {
    if (!highlightSync) return;
    const el = relaySectionRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setRelayHighlighted(true);
    const t = setTimeout(() => setRelayHighlighted(false), 2000);
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

  function openEdit(cal: typeof calendarRows[number]) {
    setShowAddForm(false);
    setEditingId(cal.id);
    setEditName(cal.display_name ?? "");
    setEditUrl(cal.url ?? "");
    setEditUsername(cal.username ?? "");
    setEditPassword(cal.password ?? "");
    setEditShowPassword(false);
    setEditColor(cal.color ?? COLORS[0]);
    setEditError(null);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function resetAddForm() {
    setShowAddForm(false);
    setAddType("ics");
    setAddUrl("");
    setAddName("");
    setAddUsername("");
    setAddPassword("");
    setAddColor(COLORS[0]);
    setAddError(null);
  }

  function openAddForm() {
    closeEdit();
    setShowAddForm(true);
  }

  async function handleAddCalendar() {
    setAddError(null);
    if (!addUrl.trim()) { setAddError("URL je povinné pole."); return; }
    try { new URL(addUrl.trim()); } catch { setAddError("Neplatná URL adresa."); return; }
    if (!addName.trim()) { setAddError("Název kalendáře je povinný."); return; }
    if (addType === "caldav" && (!addUsername.trim() || !addPassword.trim())) {
      setAddError("Pro CalDAV jsou vyžadovány přihlašovací údaje."); return;
    }

    const result = insert("calendar", {
      type: Evolu.NonEmptyString100.orThrow(addType),
      url: Evolu.NonEmptyString1000.orThrow(addUrl.trim()),
      display_name: Evolu.NonEmptyString1000.orThrow(addName.trim()),
      color: Evolu.NonEmptyString100.orThrow(addColor),
      username: addType === "caldav" && addUsername.trim()
        ? Evolu.NonEmptyString1000.orThrow(addUsername.trim()) : null,
      password: addType === "caldav" && addPassword.trim()
        ? Evolu.NonEmptyString1000.orThrow(addPassword.trim()) : null,
    });

    if (!result.ok) { setAddError("Chyba při ukládání kalendáře."); return; }

    const newId = result.value.id as CalendarId;
    show("Kalendář přidán");
    const savedUrl = addUrl.trim();
    const savedType = addType;
    const savedUsername = addUsername.trim();
    const savedPassword = addPassword.trim();
    resetAddForm();

    setAddSyncing(true);
    try {
      await syncCalendar({
        id: newId, type: savedType, url: savedUrl,
        username: savedType === "caldav" ? savedUsername : null,
        password: savedType === "caldav" ? savedPassword : null,
      });
      show("Kalendář synchronizován");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Sync selhal: ${msg.slice(0, 80)}`, { type: "error" });
    } finally {
      setAddSyncing(false);
    }
  }

  async function handleSaveCalendar(cal: typeof calendarRows[number]) {
    setEditError(null);
    if (!editUrl.trim()) { setEditError("URL je povinné pole."); return; }
    try { new URL(editUrl.trim()); } catch { setEditError("Neplatná URL adresa."); return; }
    if (!editName.trim()) { setEditError("Název je povinný."); return; }

    const id = cal.id as CalendarId;
    const type = cal.type ?? "ics";

    update("calendar", {
      id,
      display_name: Evolu.NonEmptyString1000.orThrow(editName.trim()),
      url: Evolu.NonEmptyString1000.orThrow(editUrl.trim()),
      color: Evolu.NonEmptyString100.orThrow(editColor),
      username: editUsername.trim()
        ? Evolu.NonEmptyString1000.orThrow(editUsername.trim()) : null,
      password: editPassword.trim()
        ? Evolu.NonEmptyString1000.orThrow(editPassword.trim()) : null,
    });

    show("Kalendář uložen");
    closeEdit();

    setEditSyncing(true);
    setCalErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await syncCalendar({
        id, type,
        url: editUrl.trim(),
        username: editUsername.trim() || null,
        password: editPassword.trim() || null,
      });
      show("Synchronizováno");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCalErrors((prev) => ({ ...prev, [id]: msg }));
      show(`Sync selhal: ${msg.slice(0, 80)}`, { type: "error" });
    } finally {
      setEditSyncing(false);
    }
  }

  async function handleSyncCalendar(cal: typeof calendarRows[number]) {
    const id = cal.id as CalendarId;
    setCalSyncing((prev) => ({ ...prev, [id]: true }));
    setCalErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await syncCalendar({
        id, type: cal.type, url: cal.url,
        username: cal.username,
        password: cal.password,
      });
      show("Synchronizováno");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCalErrors((prev) => ({ ...prev, [id]: msg }));
      show(`Sync selhal: ${msg.slice(0, 80)}`, { type: "error" });
    } finally {
      setCalSyncing((prev) => ({ ...prev, [id]: false }));
    }
  }

  function handleDeleteCalendar(id: CalendarId) {
    if (editingId === id) closeEdit();
    update("calendar", { id, isDeleted: 1 });
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
        <section>
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Kalendáře</h3>

          {calendarRows.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {calendarRows.map((cal) => {
                const id = cal.id as CalendarId;
                const isSyncing = calSyncing[id] ?? false;
                const isEditing = editingId === id;
                const error = mergedErrors[id];
                return (
                  <li key={id}>
                    {/* Row */}
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-ink/5 group">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cal.color ?? "#4f8ef7" }} />
                      <span className="flex-1 text-sm truncate">{cal.display_name ?? cal.url ?? "Kalendář"}</span>
                      <span className="text-[10px] uppercase tracking-wide text-ink/40 font-mono px-1.5 py-0.5 bg-ink/5 rounded">
                        {cal.type ?? "ics"}
                      </span>
                      {cal.last_fetched_at && (
                        <span className="text-[10px] text-ink/30 hidden group-hover:inline">
                          {String(cal.last_fetched_at).slice(0, 16).replace("T", " ")}
                        </span>
                      )}
                      {/* Sync */}
                      <button
                        onClick={() => handleSyncCalendar(cal)}
                        disabled={isSyncing}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink/50 hover:text-ink disabled:opacity-30"
                        title="Synchronizovat"
                      >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                      </button>
                      {/* Edit / Close edit */}
                      <button
                        onClick={() => isEditing ? closeEdit() : openEdit(cal)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-ink/50 hover:text-ink"
                        title={isEditing ? "Zavřít editaci" : "Upravit kalendář"}
                      >
                        {isEditing ? <X size={12} /> : <Pencil size={12} />}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteCalendar(id)}
                        className="text-xs text-red-500/60 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Smazat kalendář"
                      >
                        Smazat
                      </button>
                    </div>

                    {/* Persistent error */}
                    {error && !isEditing && (
                      <p className="text-xs text-red-600 mt-0.5 px-2 leading-snug">{error}</p>
                    )}

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="mt-1 border border-ink/15 rounded-xl p-4 space-y-3">
                        <input
                          type="text"
                          placeholder="Název kalendáře"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={INPUT_CLS}
                        />
                        <input
                          type="url"
                          placeholder="https://…"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className={INPUT_CLS}
                        />
                        {/* Credentials — show for caldav or if already filled */}
                        {(cal.type === "caldav" || editUsername || editPassword) && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Uživatelské jméno"
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className={INPUT_CLS}
                            />
                            <div className="flex gap-2">
                              <input
                                type={editShowPassword ? "text" : "password"}
                                placeholder="Heslo"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className={`flex-1 text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40`}
                              />
                              <button
                                type="button"
                                onClick={() => setEditShowPassword((v) => !v)}
                                className="text-xs px-2 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors whitespace-nowrap"
                              >
                                {editShowPassword ? "Skrýt" : "Zobrazit"}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Color */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink/50">Barva:</span>
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              style={{ backgroundColor: c }}
                              className={`w-5 h-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-ink/40 scale-110" : ""}`}
                            />
                          ))}
                        </div>

                        {editError && <p className="text-xs text-red-600">{editError}</p>}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveCalendar(cal)}
                            disabled={editSyncing}
                            className="text-sm px-3 py-1.5 bg-ink text-paper rounded-lg hover:bg-ink/80 disabled:opacity-40 transition-colors flex items-center gap-2"
                          >
                            {editSyncing && <RefreshCw size={12} className="animate-spin" />}
                            {editSyncing ? "Synchronizuji…" : "Uložit a synchronizovat"}
                          </button>
                          <button
                            onClick={closeEdit}
                            className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors"
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink/40 mb-3">Žádné kalendáře. Přidej ICS feed nebo CalDAV.</p>
          )}

          {!showAddForm ? (
            <button
              onClick={openAddForm}
              className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors"
            >
              + Přidat kalendář
            </button>
          ) : (
            <div className="border border-ink/15 rounded-xl p-4 space-y-3">
              <div className="flex gap-1">
                {(["ics", "caldav"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${addType === t ? "bg-ink text-paper border-ink" : "border-ink/20 hover:bg-ink/5"}`}
                  >
                    {t === "ics" ? "ICS / veřejný feed" : "CalDAV (Basic Auth)"}
                  </button>
                ))}
              </div>

              <input type="text" placeholder="Název kalendáře" value={addName} onChange={(e) => setAddName(e.target.value)} className={INPUT_CLS} />
              <input type="url" placeholder={addType === "ics" ? "https://…/calendar.ics" : "https://…/calendars/user/"} value={addUrl} onChange={(e) => setAddUrl(e.target.value)} className={INPUT_CLS} />

              {addType === "caldav" && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Uživatelské jméno" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} className="flex-1 text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40" />
                  <input type="password" placeholder="Heslo" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} className="flex-1 text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40" />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/50">Barva:</span>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setAddColor(c)} style={{ backgroundColor: c }} className={`w-5 h-5 rounded-full transition-transform ${addColor === c ? "ring-2 ring-offset-1 ring-ink/40 scale-110" : ""}`} />
                ))}
              </div>

              {addType === "caldav" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  CalDAV servery blokují browserové požadavky kvůli CORS. Pokud sync selže, použij ICS feed místo CalDAV.
                </p>
              )}

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="flex gap-2">
                <button onClick={handleAddCalendar} disabled={addSyncing} className="text-sm px-3 py-1.5 bg-ink text-paper rounded-lg hover:bg-ink/80 disabled:opacity-40 transition-colors flex items-center gap-2">
                  {addSyncing && <RefreshCw size={12} className="animate-spin" />}
                  {addSyncing ? "Synchronizuji…" : "Přidat"}
                </button>
                <button onClick={resetAddForm} className="text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors">Zrušit</button>
              </div>
            </div>
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

        {/* === Advanced section === */}
        <section ref={relaySectionRef} className={`mt-6 rounded-lg transition-all duration-300 ${relayHighlighted ? "ring-2 ring-ink/30 bg-ink/3 px-3 py-2 -mx-3" : ""}`}>
          <h3 className="text-xs uppercase tracking-wider text-ink/40 mb-3">Pokročilé</h3>

          {/* Relay URL */}
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-ink/70">Evolu relay URL</label>
            {/* Relay connection badge */}
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
