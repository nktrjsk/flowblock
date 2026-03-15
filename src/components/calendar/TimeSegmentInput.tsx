import { useState, useRef } from "react";
import type { TimeFormat } from "../../contexts/TimeFormatContext";

type Segment = "h" | "m" | "period";

interface TimeSegmentInputProps {
  /** Minutes from midnight, 0–1439 */
  totalMinutes: number;
  format: TimeFormat;
  onChange: (newTotalMinutes: number) => void;
  /** Called when Tab is pressed on the last segment (no preventDefault) */
  onTabOut?: () => void;
  hasError?: boolean;
}

export default function TimeSegmentInput({
  totalMinutes,
  format,
  onChange,
  onTabOut,
  hasError = false,
}: TimeSegmentInputProps) {
  const clamped = Math.max(0, Math.min(1439, totalMinutes));
  const h24 = Math.floor(clamped / 60);
  const min = clamped % 60;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  const displayH = format === "12h" ? h12 : h24;

  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);
  const [pendingDigit, setPendingDigit] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hRef = useRef<HTMLSpanElement>(null);
  const mRef = useRef<HTMLSpanElement>(null);
  const pRef = useRef<HTMLSpanElement>(null);

  function toMinutes(h: number, m: number, p: "AM" | "PM"): number {
    if (format === "12h") {
      const resolved = h === 12 ? (p === "AM" ? 0 : 12) : p === "PM" ? h + 12 : h;
      return resolved * 60 + m;
    }
    return h * 60 + m;
  }

  function handleKeyDown(e: React.KeyboardEvent, segment: Segment) {
    if (e.key === "Tab" && !e.shiftKey) {
      if (segment === "h") {
        e.preventDefault();
        setPendingDigit(null);
        setActiveSegment("m");
        mRef.current?.focus();
      } else if (segment === "m" && format === "12h") {
        e.preventDefault();
        setPendingDigit(null);
        setActiveSegment("period");
        pRef.current?.focus();
      } else {
        setPendingDigit(null);
        setActiveSegment(null);
        onTabOut?.();
        // no preventDefault — browser moves focus naturally to next element
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPendingDigit(null);
      if (segment === "m") { setActiveSegment("h"); hRef.current?.focus(); }
      else if (segment === "period") { setActiveSegment("m"); mRef.current?.focus(); }
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setPendingDigit(null);
      if (segment === "h") { setActiveSegment("m"); mRef.current?.focus(); }
      else if (segment === "m" && format === "12h") { setActiveSegment("period"); pRef.current?.focus(); }
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setPendingDigit(null);
      const dir = e.key === "ArrowUp" ? 1 : -1;
      if (segment === "h") {
        if (format === "12h") {
          const newH = (displayH - 1 + dir + 12) % 12 + 1;
          onChange(toMinutes(newH, min, period));
        } else {
          onChange(((h24 + dir + 24) % 24) * 60 + min);
        }
      } else if (segment === "m") {
        const newM = Math.max(0, Math.min(59, min + dir * 5));
        onChange(format === "12h" ? toMinutes(displayH, newM, period) : h24 * 60 + newM);
      } else if (segment === "period") {
        onChange(toMinutes(displayH, min, period === "AM" ? "PM" : "AM"));
      }
      return;
    }

    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const digit = e.key;
      const n = parseInt(digit);

      if (segment === "h") {
        const maxFirst = format === "24h" ? 2 : 1;
        if (pendingDigit === null) {
          if (n > maxFirst) {
            const newH = Math.min(format === "12h" ? 12 : 23, Math.max(format === "12h" ? 1 : 0, n));
            onChange(format === "12h" ? toMinutes(newH, min, period) : newH * 60 + min);
            setPendingDigit(null);
            setActiveSegment("m");
            setTimeout(() => mRef.current?.focus(), 0);
          } else {
            setPendingDigit(digit);
          }
        } else {
          const newH = parseInt(pendingDigit + digit);
          const clamped = Math.max(format === "12h" ? 1 : 0, Math.min(format === "12h" ? 12 : 23, newH));
          onChange(format === "12h" ? toMinutes(clamped, min, period) : clamped * 60 + min);
          setPendingDigit(null);
          setActiveSegment("m");
          setTimeout(() => mRef.current?.focus(), 0);
        }
      } else if (segment === "m") {
        if (pendingDigit === null) {
          if (n > 5) {
            onChange(format === "12h" ? toMinutes(displayH, n, period) : h24 * 60 + n);
            setPendingDigit(null);
            if (format === "12h") {
              setActiveSegment("period");
              setTimeout(() => pRef.current?.focus(), 0);
            } else {
              setActiveSegment(null);
              onTabOut?.();
            }
          } else {
            setPendingDigit(digit);
          }
        } else {
          const newM = Math.min(59, parseInt(pendingDigit + digit));
          onChange(format === "12h" ? toMinutes(displayH, newM, period) : h24 * 60 + newM);
          setPendingDigit(null);
          if (format === "12h") {
            setActiveSegment("period");
            setTimeout(() => pRef.current?.focus(), 0);
          } else {
            setActiveSegment(null);
            onTabOut?.();
          }
        }
      }
      return;
    }

    if (segment === "period" && format === "12h") {
      if (e.key.toLowerCase() === "a") { e.preventDefault(); onChange(toMinutes(displayH, min, "AM")); }
      if (e.key.toLowerCase() === "p") { e.preventDefault(); onChange(toMinutes(displayH, min, "PM")); }
    }
  }

  const segCls = (seg: Segment) =>
    `px-0.5 py-px rounded outline-none select-none leading-none transition-colors ${
      activeSegment === seg
        ? "bg-[#1a1a2e] text-[#f5f0e8]"
        : "text-[#1a1a2e] hover:bg-[#1a1a2e]/8"
    }`;

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center border rounded px-2 py-1 text-xs font-mono w-full ${
        hasError
          ? "border-red-400 bg-red-50/50"
          : activeSegment !== null
          ? "border-[#1a1a2e]/40"
          : "border-[#1a1a2e]/15"
      }`}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setActiveSegment(null);
          setPendingDigit(null);
        }
      }}
    >
      <span
        ref={hRef}
        tabIndex={0}
        className={segCls("h")}
        onFocus={() => { setActiveSegment("h"); setPendingDigit(null); }}
        onMouseDown={(e) => { e.preventDefault(); setActiveSegment("h"); hRef.current?.focus(); }}
        onKeyDown={(e) => handleKeyDown(e, "h")}
      >
        {activeSegment === "h" && pendingDigit ? pendingDigit : String(displayH).padStart(2, "0")}
      </span>
      <span className="text-[#1a1a2e]/30 select-none">:</span>
      <span
        ref={mRef}
        tabIndex={0}
        className={segCls("m")}
        onFocus={() => { setActiveSegment("m"); setPendingDigit(null); }}
        onMouseDown={(e) => { e.preventDefault(); setActiveSegment("m"); mRef.current?.focus(); }}
        onKeyDown={(e) => handleKeyDown(e, "m")}
      >
        {activeSegment === "m" && pendingDigit ? pendingDigit : String(min).padStart(2, "0")}
      </span>
      {format === "12h" && (
        <>
          <span className="text-[#1a1a2e]/20 select-none">&thinsp;</span>
          <span
            ref={pRef}
            tabIndex={0}
            className={segCls("period")}
            onFocus={() => { setActiveSegment("period"); setPendingDigit(null); }}
            onMouseDown={(e) => { e.preventDefault(); setActiveSegment("period"); pRef.current?.focus(); }}
            onKeyDown={(e) => handleKeyDown(e, "period")}
          >
            {period}
          </span>
        </>
      )}
    </div>
  );
}
