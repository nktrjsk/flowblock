import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Mnemonic } from "@evolu/common";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { CalendarId } from "../../db/schema";
import { syncCalendar } from "../../services/calendarSync";
import { useToast } from "../ui/Toast";

interface SettingsModalProps {
  onClose: () => void;
  syncErrors: Record<string, string>;
}

const calendarsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("calendar")
    .select(["id", "type", "url", "display_name", "color", "last_fetched_at"])
    .where("isDeleted", "is", null)
    .orderBy("display_name", "asc"),
);

const COLORS = ["#4f8ef7", "#e85d5d", "#4caf7a", "#e09b2f", "#9b59b6", "#1a1a2e"];

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
    if (!parsed.ok) {
      setImportError("Neplatný formát klíče. Zkontroluj 24 slov.");
      return;
    }
    await evolu.restoreAppOwner(parsed.value);
  }

  const shortId = ownerId
    ? `${ownerId.slice(0, 8)}…${ownerId.slice(-4)}`
    : "…";

  // --- Calendars section ---
  const calendarRows = useQuery(calendarsQuery);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"ics" | "caldav">("ics");
  const [addUrl, setAddUrl] = useState("");
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addColor, setAddColor] = useState(COLORS[0]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSyncing, setAddSyncing] = useState(false);

  // Per-calendar syncing state: calendarId → boolean
  const [calSyncing, setCalSyncing] = useState<Record<string, boolean>>({});
  // Per-calendar manual errors (merge with background errors from props)
  const [calErrors, setCalErrors] = useState<Record<string, string>>({});

  const mergedErrors: Record<string, string> = { ...syncErrors, ...calErrors };

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
    resetAddForm();

    setAddSyncing(true);
    try {
      await syncCalendar({
        id: newId,
        type: addType,
        url: addUrl.trim(),
        username: addType === "caldav" ? addUsername.trim() : null,
        password: addType === "caldav" ? addPassword.trim() : null,
      });
      show("Kalendář synchronizován");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Sync selhal: ${msg.slice(0, 80)}`, { type: "error" });
    } finally {
      setAddSyncing(false);
    }
  }

  async function handleSyncCalendar(cal: typeof calendarRows[number]) {
    const id = cal.id as CalendarId;
    setCalSyncing((prev) => ({ ...prev, [id]: true }));
    setCalErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await syncCalendar({
        id,
        type: cal.type,
        url: cal.url,
        username: null,
        password: null,
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
          <button
            onClick={onClose}
            className="text-[#1a1a2e]/40 hover:text-[#1a1a2e] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* === Identity section === */}
        <section className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">
            Identita (Evolu)
          </h3>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-[#1a1a2e]/60">Owner ID:</span>
            <code className="text-sm font-mono bg-[#1a1a2e]/5 px-2 py-0.5 rounded">
              {shortId}
            </code>
          </div>

          {!showMnemonic ? (
            <button
              onClick={() => setShowMnemonic(true)}
              className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors mr-2 mb-2"
            >
              Zobrazit owner key
            </button>
          ) : (
            <div className="mb-4">
              <p className="text-xs text-[#1a1a2e]/50 mb-1">
                Tvůj owner key (24 slov) — nikomu nesdílej:
              </p>
              <code className="block text-xs font-mono bg-[#1a1a2e]/5 p-3 rounded-lg leading-relaxed break-words">
                {mnemonic ?? "načítání…"}
              </code>
              <button
                onClick={handleCopy}
                className="mt-2 text-xs px-3 py-1 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
              >
                {copied ? "Zkopírováno!" : "Kopírovat"}
              </button>
            </div>
          )}

          {!showImport ? (
            <button
              onClick={() => setShowImport(true)}
              className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
            >
              Importovat owner key
            </button>
          ) : (
            <div className="mt-1">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                Importování jiného klíče přepíše lokální identitu. Data se
                obnoví ze sync serveru.
              </p>
              <textarea
                value={importValue}
                onChange={(e) => { setImportValue(e.target.value); setImportError(null); }}
                placeholder="Vlož 24 slov owner key…"
                className="w-full text-xs font-mono bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg p-2 resize-none h-20 focus:outline-none focus:border-[#1a1a2e]/40"
              />
              {importError && <p className="text-xs text-red-600 mt-1">{importError}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleImport}
                  disabled={!importValue.trim()}
                  className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors"
                >
                  Importovat
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportValue(""); setImportError(null); }}
                  className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}
        </section>

        {/* === Calendars section === */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">
            Kalendáře
          </h3>

          {calendarRows.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {calendarRows.map((cal) => {
                const id = cal.id as CalendarId;
                const isSyncing = calSyncing[id] ?? false;
                const error = mergedErrors[id];
                return (
                  <li key={id}>
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#1a1a2e]/5 group">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color ?? "#4f8ef7" }}
                      />
                      <span className="flex-1 text-sm truncate">
                        {cal.display_name ?? cal.url ?? "Kalendář"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-[#1a1a2e]/40 font-mono px-1.5 py-0.5 bg-[#1a1a2e]/5 rounded">
                        {cal.type ?? "ics"}
                      </span>
                      {cal.last_fetched_at && (
                        <span className="text-[10px] text-[#1a1a2e]/30 hidden group-hover:inline">
                          {String(cal.last_fetched_at).slice(0, 16).replace("T", " ")}
                        </span>
                      )}
                      {/* Per-calendar sync button */}
                      <button
                        onClick={() => handleSyncCalendar(cal)}
                        disabled={isSyncing}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#1a1a2e]/50 hover:text-[#1a1a2e] disabled:opacity-30"
                        title="Synchronizovat"
                      >
                        <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => handleDeleteCalendar(id)}
                        className="text-xs text-red-500/60 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Smazat kalendář"
                      >
                        Smazat
                      </button>
                    </div>
                    {/* Persistent error text */}
                    {error && (
                      <p className="text-xs text-red-600 mt-0.5 px-2 leading-snug">
                        {error}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[#1a1a2e]/40 mb-3">
              Žádné kalendáře. Přidej ICS feed nebo CalDAV.
            </p>
          )}

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
            >
              + Přidat kalendář
            </button>
          ) : (
            <div className="border border-[#1a1a2e]/15 rounded-xl p-4 space-y-3">
              {/* Type toggle */}
              <div className="flex gap-1">
                {(["ics", "caldav"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      addType === t
                        ? "bg-[#1a1a2e] text-[#f5f0e8] border-[#1a1a2e]"
                        : "border-[#1a1a2e]/20 hover:bg-[#1a1a2e]/5"
                    }`}
                  >
                    {t === "ics" ? "ICS / veřejný feed" : "CalDAV (Basic Auth)"}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Název kalendáře"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40"
              />

              <input
                type="url"
                placeholder={addType === "ics" ? "https://…/calendar.ics" : "https://…/calendars/user/"}
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                className="w-full text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40"
              />

              {addType === "caldav" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Uživatelské jméno"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    className="flex-1 text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40"
                  />
                  <input
                    type="password"
                    placeholder="Heslo"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="flex-1 text-sm bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1a1a2e]/40"
                  />
                </div>
              )}

              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#1a1a2e]/50">Barva:</span>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAddColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      addColor === c ? "ring-2 ring-offset-1 ring-[#1a1a2e]/40 scale-110" : ""
                    }`}
                  />
                ))}
              </div>

              {addType === "caldav" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  CalDAV servery blokují browserové požadavky kvůli CORS.
                  Pokud sync selže, použij ICS feed místo CalDAV.
                </p>
              )}

              {addError && <p className="text-xs text-red-600">{addError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleAddCalendar}
                  disabled={addSyncing}
                  className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  {addSyncing && <RefreshCw size={12} className="animate-spin" />}
                  {addSyncing ? "Synchronizuji…" : "Přidat"}
                </button>
                <button
                  onClick={resetAddForm}
                  className="text-sm px-3 py-1.5 border border-[#1a1a2e]/20 rounded-lg hover:bg-[#1a1a2e]/5 transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
