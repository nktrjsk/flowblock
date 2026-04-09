import { useState } from "react";
import { RefreshCw, Pencil, X } from "lucide-react";
import * as Evolu from "@evolu/common";
import { useQuerySubscription } from "@evolu/react";
import { evolu, useEvolu } from "../../db/evolu";
import { CalendarId } from "../../db/schema";
import { syncCalendar } from "../../services/calendarSync";
import { useToast } from "../ui/Toast";

const calendarsQuery = evolu.createQuery((db) =>
  db
    .selectFrom("calendar")
    .select(["id", "type", "url", "display_name", "color", "last_fetched_at", "username", "password"])
    .where("isDeleted", "is", null)
    .orderBy("display_name", "asc"),
);
evolu.loadQuery(calendarsQuery);

const COLORS = ["#4f8ef7", "#e85d5d", "#4caf7a", "#e09b2f", "#9b59b6", "#1a1a2e"];
const INPUT_CLS = "w-full text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40";

interface CalendarsSectionProps {
  syncErrors: Record<string, string>;
}

export function CalendarsSection({ syncErrors }: CalendarsSectionProps) {
  const { insert, update } = useEvolu();
  const { show } = useToast();
  const calendarRows = useQuerySubscription(calendarsQuery);

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
                            className="flex-1 text-sm bg-ink/5 border border-ink/20 rounded-lg px-3 py-1.5 focus:outline-none focus:border-ink/40"
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
  );
}
