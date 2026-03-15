import { useState, useEffect } from "react";
import { RefreshCw, Pencil, X } from "lucide-react";
import { Mnemonic } from "@evolu/common";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { CalendarId } from "../../db/schema";
import { syncCalendar, getCorsProxy, setCorsProxy } from "../../services/calendarSync";
import { requestPermissionIfNeeded } from "../../hooks/useBlockTransitionNotifications";
import { NOTIFICATIONS_ENABLED_KEY } from "../../constants";
import { useToast } from "../ui/Toast";
import { useTimeFormat } from "../../contexts/TimeFormatContext";

interface SettingsModalProps {
  onClose: () => void;
  syncErrors: Record<string, string>;
}

const calendarsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("calendar")
    .select(["id", "type", "url", "display_name", "color", "last_fetched_at", "username", "password"])
    .where("isDeleted", "is", null)
    .orderBy("display_name", "asc"),
);

const COLORS = ["#4f8ef7", "#e85d5d", "#4caf7a", "#e09b2f", "#9b59b6", "#1a1a2e"];

const INPUT_CLS = "w-full text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40";

export default function SettingsModal({ onClose, syncErrors }: SettingsModalProps) {
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
  const [corsProxy, setCorsProxyState] = useState(() => getCorsProxy());
  const { timeFormat, setTimeFormat } = useTimeFormat();

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
        className="bg-[#f5f0e8] border border-[#1a1a2e]/20 rounded-xl shadow-xl w-[520px] max-w-[95vw] p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Nastavení</h2>
          <button onClick={onClose} className="text-[#1a1a2e]/40 hover:text-[#1a1a2e] text-xl leading-none">✕</button>
        </div>

        {/* === Identity section === */}
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">Identita (Evolu)</h3>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-[#1a1a2e]/60">Owner ID:</span>
            <code className="text-sm font-mono bg-[#1a1a2e]/5 px-2 py-0.5 rounded">{shortId}</code>
          </div>

          {!showMnemonic ? (
            <button onClick={() => setShowMnemonic(true)} className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors mr-2 mb-2">
              Zobrazit owner key
            </button>
          ) : (
            <div className="mb-4">
              <p className="text-xs text-[#1a1a2e]/50 mb-1">Tvůj owner key (24 slov) — nikomu nesdílej:</p>
              <code className="block text-xs font-mono bg-[#1a1a2e]/5 p-3 rounded-lg leading-relaxed break-words">
                {mnemonic ?? "načítání…"}
              </code>
              <button onClick={handleCopy} className="mt-2 text-xs px-3 py-1 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors">
                {copied ? "Zkopírováno!" : "Kopírovat"}
              </button>
            </div>
          )}

          {!showImport ? (
            <button onClick={() => setShowImport(true)} className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors">
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
                className="w-full text-xs font-mono bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg p-2 resize-none h-20 focus:outline-none focus:border-[#1a1a2e]/40"
              />
              {importError && <p className="text-xs text-red-600 mt-1">{importError}</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={handleImport} disabled={!importValue.trim()} className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors">
                  Importovat
                </button>
                <button onClick={() => { setShowImport(false); setImportValue(""); setImportError(null); }} className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors">
                  Zrušit
                </button>
              </div>
            </div>
          )}
        </section>

        {/* === Calendars section === */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">Kalendáře</h3>

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
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#1a1a2e]/5 group">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cal.color ?? "#4f8ef7" }} />
                      <span className="flex-1 text-sm truncate">{cal.display_name ?? cal.url ?? "Kalendář"}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[#1a1a2e]/40 font-mono px-1.5 py-0.5 bg-[#1a1a2e]/5 rounded">
                        {cal.type ?? "ics"}
                      </span>
                      {cal.last_fetched_at && (
                        <span className="text-[10px] text-[#1a1a2e]/30 hidden group-hover:inline">
                          {String(cal.last_fetched_at).slice(0, 16).replace("T", " ")}
                        </span>
                      )}
                      {/* Sync */}
                      <button
                        onClick={() => handleSyncCalendar(cal)}
                        disabled={isSyncing}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#1a1a2e]/50 hover:text-[#1a1a2e] disabled:opacity-30"
                        title="Synchronizovat"
                      >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                      </button>
                      {/* Edit / Close edit */}
                      <button
                        onClick={() => isEditing ? closeEdit() : openEdit(cal)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#1a1a2e]/50 hover:text-[#1a1a2e]"
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
                      <div className="mt-1 border border-[#1a1a2e]/15 rounded-xl p-4 space-y-3">
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
                                className={`flex-1 text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40`}
                              />
                              <button
                                type="button"
                                onClick={() => setEditShowPassword((v) => !v)}
                                className="text-xs px-2 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors whitespace-nowrap"
                              >
                                {editShowPassword ? "Skrýt" : "Zobrazit"}
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Color */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#1a1a2e]/50">Barva:</span>
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              style={{ backgroundColor: c }}
                              className={`w-5 h-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-[#1a1a2e]/40 scale-110" : ""}`}
                            />
                          ))}
                        </div>

                        {editError && <p className="text-xs text-red-600">{editError}</p>}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveCalendar(cal)}
                            disabled={editSyncing}
                            className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors flex items-center gap-2"
                          >
                            {editSyncing && <RefreshCw size={12} className="animate-spin" />}
                            {editSyncing ? "Synchronizuji…" : "Uložit a synchronizovat"}
                          </button>
                          <button
                            onClick={closeEdit}
                            className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
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
            <p className="text-sm text-[#1a1a2e]/40 mb-3">Žádné kalendáře. Přidej ICS feed nebo CalDAV.</p>
          )}

          {!showAddForm ? (
            <button
              onClick={openAddForm}
              className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
            >
              + Přidat kalendář
            </button>
          ) : (
            <div className="border border-[#1a1a2e]/15 rounded-xl p-4 space-y-3">
              <div className="flex gap-1">
                {(["ics", "caldav"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${addType === t ? "bg-[#1a1a2e] text-[#f5f0e8] border-[#1a1a2e]" : "border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5"}`}
                  >
                    {t === "ics" ? "ICS / veřejný feed" : "CalDAV (Basic Auth)"}
                  </button>
                ))}
              </div>

              <input type="text" placeholder="Název kalendáře" value={addName} onChange={(e) => setAddName(e.target.value)} className={INPUT_CLS} />
              <input type="url" placeholder={addType === "ics" ? "https://…/calendar.ics" : "https://…/calendars/user/"} value={addUrl} onChange={(e) => setAddUrl(e.target.value)} className={INPUT_CLS} />

              {addType === "caldav" && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Uživatelské jméno" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} className="flex-1 text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40" />
                  <input type="password" placeholder="Heslo" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} className="flex-1 text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40" />
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#1a1a2e]/50">Barva:</span>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setAddColor(c)} style={{ backgroundColor: c }} className={`w-5 h-5 rounded-full transition-transform ${addColor === c ? "ring-2 ring-offset-1 ring-[#1a1a2e]/40 scale-110" : ""}`} />
                ))}
              </div>

              {addType === "caldav" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  CalDAV servery blokují browserové požadavky kvůli CORS. Pokud sync selže, použij ICS feed místo CalDAV.
                </p>
              )}

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="flex gap-2">
                <button onClick={handleAddCalendar} disabled={addSyncing} className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors flex items-center gap-2">
                  {addSyncing && <RefreshCw size={12} className="animate-spin" />}
                  {addSyncing ? "Synchronizuji…" : "Přidat"}
                </button>
                <button onClick={resetAddForm} className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors">Zrušit</button>
              </div>
            </div>
          )}
        </section>

        {/* === Appearance section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">Vzhled</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#1a1a2e]/80">Formát času</p>
              <p className="text-xs text-[#1a1a2e]/40 mt-0.5">Platí pro všechna časová zobrazení v aplikaci.</p>
            </div>
            <div className="flex rounded-lg border border-[#1a1a2e]/15 overflow-hidden shrink-0">
              {(["24h", "12h"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFormat(f)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    timeFormat === f
                      ? "bg-[#1a1a2e] text-[#f5f0e8]"
                      : "bg-transparent text-[#1a1a2e]/50 hover:bg-[#1a1a2e]/5"
                  }`}
                >
                  {f === "24h" ? "24h" : "AM/PM"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* === Notifications section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">Oznámení</h3>
          {notifPermission === "unsupported" ? (
            <p className="text-sm text-[#1a1a2e]/40">Notifikace nejsou v tomto prohlížeči podporovány.</p>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#1a1a2e]/80">Připomenutí přechodů mezi bloky</p>
                <p className="text-xs text-[#1a1a2e]/40 mt-0.5">
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
                  notificationsEnabled ? "bg-[#1a1a2e]" : "bg-[#1a1a2e]/20"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    notificationsEnabled ? "left-5" : "left-1"
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        {/* === Advanced section === */}
        <section className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">Pokročilé</h3>
          <label className="block text-sm text-[#1a1a2e]/70 mb-1">CORS proxy URL</label>
          <input
            type="url"
            value={corsProxy}
            onChange={(e) => { setCorsProxyState(e.target.value); setCorsProxy(e.target.value); }}
            placeholder="https://corsproxy.io/?url="
            className={`${INPUT_CLS} font-mono`}
          />
          <p className="text-xs text-[#1a1a2e]/40 mt-1">
            Pokud ICS sync selže kvůli CORS, nastav proxy která přidá potřebné hlavičky. Hodnota se přidá před URL kalendáře.{" "}
            <a href="https://corsproxy.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1a1a2e]/60">corsproxy.io</a>{" "}
            je zdarma dostupná varianta.
          </p>
        </section>
      </div>
    </div>
  );
}
