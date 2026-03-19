import { X } from "lucide-react";

interface HelpModalProps {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Inbox",
    items: [
      { keys: ["Enter"], desc: "Přidat nový úkol" },
      { keys: ["//", "Enter"], desc: "Přidat poznámku místo úkolu" },
      { keys: ["click na název"], desc: "Editovat úkol inline" },
      { keys: ["🚩"], desc: "Nastavit prioritu úkolu" },
      { keys: ["drag"], desc: "Přetáhnout úkol do kalendáře" },
    ],
  },
  {
    title: "Kalendář",
    items: [
      { keys: ["double-click"], desc: "Vytvořit nový timeblock" },
      { keys: ["drag z inboxu"], desc: "Naplánovat úkol na konkrétní čas" },
      { keys: ["drag z inboxu na blok"], desc: "Přiřadit úkol k existujícímu bloku" },
      { keys: ["drag bloku"], desc: "Přesunout timeblock na jiný čas nebo den" },
      { keys: ["⠿ okraje bloku"], desc: "Změnit délku bloku tažením" },
      { keys: ["click na blok"], desc: "Otevřít detail bloku" },
    ],
  },
  {
    title: "Detail bloku",
    items: [
      { keys: ["Ctrl", "↵"], desc: "Uložit změny" },
      { keys: ["Esc"], desc: "Zavřít bez uložení" },
      { keys: ["Del"], desc: "Smazat blok" },
      { keys: ["← →"], desc: "Změnit prioritu bloku" },
      { keys: ["🔗"], desc: "Propojit/odpojit úkol" },
    ],
  },
  {
    title: "Navigace",
    items: [
      { keys: ["Esc"], desc: "Zavřít otevřený panel nebo modal" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-ink/20 bg-ink/5 text-[10px] font-mono text-ink/70 leading-none whitespace-nowrap">
      {children}
    </kbd>
  );
}

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[80]" onClick={onClose} />
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-surface rounded-xl shadow-xl border border-ink/10 w-full max-w-md max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-ink/8 shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-ink">Nápověda</h2>
              <p className="text-[11px] text-ink/40 mt-0.5">Přehled funkcí a zkratek</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-ink/8 text-ink/40 hover:text-ink/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink/35 mb-2">
                  {section.title}
                </div>
                <div className="flex flex-col gap-1.5">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <span className="text-xs text-ink/60 flex-1">{item.desc}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, j) => (
                          <Kbd key={j}>{k}</Kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="border-t border-dashed border-ink/15 pt-4 mt-1">
              <p className="text-[10px] text-ink/35 leading-relaxed">
                Data jsou uložena lokálně v tvém prohlížeči.<br />
                Sync mezi zařízeními lze zapnout v{" "}
                <button
                  onClick={onClose}
                  className="underline underline-offset-2 hover:text-ink/60 transition-colors"
                >
                  Nastavení
                </button>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
