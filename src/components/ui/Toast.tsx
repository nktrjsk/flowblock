import { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ShowOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  show: (message?: string, options?: ShowOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message = "Hotovo!", options: ShowOptions = {}) => {
    const { type = "success", duration } = options;
    const ms = duration ?? (type === "error" ? 6000 : 2200);
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-14 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg shadow-md animate-slide-in border ${
              t.type === "error"
                ? "bg-surface border-red-200 text-red-800 dark:border-red-800 dark:text-red-300"
                : "bg-surface border-green-200 text-green-800 dark:border-green-800 dark:text-green-300"
            }`}
          >
            {t.type === "error" ? (
              <svg viewBox="0 0 16 16" className="w-4 h-4 text-red-500 shrink-0" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="w-4 h-4 text-green-500 shrink-0" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
