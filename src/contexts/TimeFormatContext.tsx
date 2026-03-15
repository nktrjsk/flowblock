import { createContext, useContext, useState } from "react";

export type TimeFormat = "24h" | "12h";

export const TIME_FORMAT_KEY = "flowblock_time_format";

export function formatMinutes(totalMinutes: number, format: TimeFormat): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  if (format === "12h") {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatIso(iso: string, format: TimeFormat): string {
  const d = new Date(iso);
  return formatMinutes(d.getHours() * 60 + d.getMinutes(), format);
}

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (f: TimeFormat) => void;
}

const TimeFormatContext = createContext<TimeFormatContextValue>({
  timeFormat: "24h",
  setTimeFormat: () => {},
});

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(
    () => (localStorage.getItem(TIME_FORMAT_KEY) as TimeFormat) ?? "24h",
  );

  function setTimeFormat(f: TimeFormat) {
    localStorage.setItem(TIME_FORMAT_KEY, f);
    setTimeFormatState(f);
  }

  return (
    <TimeFormatContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat() {
  return useContext(TimeFormatContext);
}
