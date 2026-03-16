import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import type { TimeFormat } from "../../contexts/TimeFormatContext";

type Segment = "h" | "m" | "period";

interface TimeSegmentInputProps {
  totalMinutes: number;
  format: TimeFormat;
  onChange: (newTotalMinutes: number) => void;
  /** Called when Tab is pressed (exits the whole field) */
  onTabOut?: () => void;
  /** Called when ArrowRight is pressed on the last segment */
  onArrowRight?: () => void;
  /** Called when ArrowLeft is pressed on the first segment */
  onArrowLeft?: () => void;
  hasError?: boolean;
}

export interface TimeSegmentInputHandle {
  focusFirst: () => void;
  focusLast: () => void;
}

const TimeSegmentInput = forwardRef<TimeSegmentInputHandle, TimeSegmentInputProps>(
  function TimeSegmentInput(
    { totalMinutes, format, onChange, onTabOut, onArrowRight, onArrowLeft, hasError = false },
    ref,
  ) {
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

    useImperativeHandle(ref, () => ({
      focusFirst: () => { setActiveSegment("h"); setPendingDigit(null); hRef.current?.focus(); },
      focusLast: () => {
        if (format === "12h") { setActiveSegment("period"); setPendingDigit(null); pRef.current?.focus(); }
        else { setActiveSegment("m"); setPendingDigit(null); mRef.current?.focus(); }
      },
    }));

    function toMinutes(h: number, m: number, p: "AM" | "PM"): number {
      if (format === "12h") {
        const resolved = h === 12 ? (p === "AM" ? 0 : 12) : p === "PM" ? h + 12 : h;
        return resolved * 60 + m;
      }
      return h * 60 + m;
    }

    function handleKeyDown(e: React.KeyboardEvent, segment: Segment) {
      // Tab always exits the whole field
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setPendingDigit(null);
        setActiveSegment(null);
        onTabOut?.();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPendingDigit(null);
        if (segment === "m") { setActiveSegment("h"); hRef.current?.focus(); }
        else if (segment === "period") { setActiveSegment("m"); mRef.current?.focus(); }
        else if (segment === "h") { onArrowLeft?.(); }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPendingDigit(null);
        if (segment === "h") { setActiveSegment("m"); mRef.current?.focus(); }
        else if (segment === "m" && format === "12h") { setActiveSegment("period"); pRef.current?.focus(); }
        else { onArrowRight?.(); }
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
            const clampedH = Math.max(format === "12h" ? 1 : 0, Math.min(format === "12h" ? 12 : 23, newH));
            onChange(format === "12h" ? toMinutes(clampedH, min, period) : clampedH * 60 + min);
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
          ? "bg-ink text-paper"
          : "text-ink hover:bg-ink/8"
      }`;

    return (
      <div
        ref={containerRef}
        className={`inline-flex items-center border rounded px-2 py-1 text-xs font-mono w-full ${
          hasError
            ? "border-red-400 bg-red-50/50"
            : activeSegment !== null
            ? "border-ink/40"
            : "border-ink/15"
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
        <span className="text-ink/30 select-none">:</span>
        <span
          ref={mRef}
          tabIndex={-1}
          className={segCls("m")}
          onFocus={() => { setActiveSegment("m"); setPendingDigit(null); }}
          onMouseDown={(e) => { e.preventDefault(); setActiveSegment("m"); mRef.current?.focus(); }}
          onKeyDown={(e) => handleKeyDown(e, "m")}
        >
          {activeSegment === "m" && pendingDigit ? pendingDigit : String(min).padStart(2, "0")}
        </span>
        {format === "12h" && (
          <>
            <span className="text-ink/20 select-none">&thinsp;</span>
            <span
              ref={pRef}
              tabIndex={-1}
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
  },
);

export default TimeSegmentInput;
