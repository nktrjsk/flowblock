import { useState, useRef, useEffect } from "react";
import { HOUR_HEIGHT_PX, SNAP_MINUTES } from "../constants";
import { createTimeBlock } from "../services/timeBlocks";

function snapMinutes(raw: number) {
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface Props {
  days: Date[];
  getDayColumnEl: (dayIndex: number) => HTMLElement | null;
}

export function useNewBlockDrag({ days, getDayColumnEl }: Props) {
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [newBlockDrag, setNewBlockDrag] = useState<{
    dayIndex: number;
    anchorMinutes: number;
    currentMinutes: number;
  } | null>(null);
  const lastClickRef = useRef<{ time: number; dayIndex: number; minutes: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!newBlockDrag) return;
      const colEl = getDayColumnEl(newBlockDrag.dayIndex);
      if (!colEl) return;
      const minutes = clamp(snapMinutes(((e.clientY - colEl.getBoundingClientRect().top) / HOUR_HEIGHT_PX) * 60), 0, 24 * 60 - SNAP_MINUTES);
      setNewBlockDrag((prev) => prev ? { ...prev, currentMinutes: minutes } : null);
    }

    function onMouseUp() {
      if (!newBlockDrag) return;
      const drag = newBlockDrag;
      setNewBlockDrag(null);

      const startMinutes = Math.min(drag.anchorMinutes, drag.currentMinutes);
      const rawDuration = Math.abs(drag.currentMinutes - drag.anchorMinutes);
      const durationMinutes = rawDuration < SNAP_MINUTES ? 60 : rawDuration;
      const endMinutes = Math.min(startMinutes + durationMinutes, 24 * 60);

      const result = createTimeBlock(days[drag.dayIndex], startMinutes, endMinutes);
      if (result.ok) {
        setPendingOpenId(String(result.id));
        setTimeout(() => setPendingOpenId(null), 500);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // getDayColumnEl and createTimeBlock are stable; newBlockDrag is the only reactive dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newBlockDrag]);

  function handleColMouseDown(e: React.MouseEvent, dayIndex: number) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-block],[data-popover]")) return;
    const colEl = getDayColumnEl(dayIndex);
    if (!colEl) return;
    const rawMinutes = ((e.clientY - colEl.getBoundingClientRect().top) / HOUR_HEIGHT_PX) * 60;
    const minutes = clamp(Math.floor(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES, 0, 24 * 60 - SNAP_MINUTES);

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && (now - last.time) < 400 && last.dayIndex === dayIndex && Math.abs(last.minutes - minutes) <= SNAP_MINUTES) {
      lastClickRef.current = null;
      e.preventDefault();
      setNewBlockDrag({ dayIndex, anchorMinutes: minutes, currentMinutes: minutes });
    } else {
      lastClickRef.current = { time: now, dayIndex, minutes };
    }
  }

  const newBlockGhost = newBlockDrag
    ? {
        dayIndex: newBlockDrag.dayIndex,
        startMinutes: Math.min(newBlockDrag.anchorMinutes, newBlockDrag.currentMinutes),
        durationMinutes: Math.max(SNAP_MINUTES, Math.abs(newBlockDrag.currentMinutes - newBlockDrag.anchorMinutes)),
      }
    : null;

  return { newBlockDrag, newBlockGhost, pendingOpenId, handleColMouseDown };
}
