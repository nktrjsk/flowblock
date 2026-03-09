import { useState, useEffect } from "react";
import { Mnemonic } from "@evolu/common";
import { evolu } from "../../db/evolu";

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-[#f5f0e8] border border-[#1a1a2e]/20 rounded-xl shadow-xl w-[480px] max-w-[95vw] p-6"
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

        <section>
          <h3 className="text-xs uppercase tracking-wider text-[#1a1a2e]/40 mb-3">
            Identita (Evolu)
          </h3>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-[#1a1a2e]/60">Owner ID:</span>
            <code className="text-sm font-mono bg-[#1a1a2e]/5 px-2 py-0.5 rounded">
              {shortId}
            </code>
          </div>

          {/* Export */}
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

          {/* Import */}
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
                onChange={(e) => {
                  setImportValue(e.target.value);
                  setImportError(null);
                }}
                placeholder="Vlož 24 slov owner key…"
                className="w-full text-xs font-mono bg-[#1a1a2e]/5 border border-[#1a1a2e]/20 rounded-lg p-2 resize-none h-20 focus:outline-none focus:border-[#1a1a2e]/40"
              />
              {importError && (
                <p className="text-xs text-red-600 mt-1">{importError}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleImport}
                  disabled={!importValue.trim()}
                  className="text-sm px-3 py-1.5 bg-[#1a1a2e] text-[#f5f0e8] rounded-lg hover:bg-[#1a1a2e]/80 disabled:opacity-40 transition-colors"
                >
                  Importovat
                </button>
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportValue("");
                    setImportError(null);
                  }}
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
