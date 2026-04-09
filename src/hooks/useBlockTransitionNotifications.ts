import { useEffect, useRef } from "react";
import { useQuerySubscription } from "@evolu/react";
import { timeBlocksQuery, getTodayBlocks } from "./useNowAndNext";
import { NOTIFICATION_LEAD_MINUTES, NOTIFICATIONS_ENABLED_KEY } from "../constants";

const CHECK_INTERVAL_MS = 30_000; // check every 30 seconds

async function requestPermissionIfNeeded(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function showNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/favicon.ico", silent: false });
}

export function useBlockTransitionNotifications() {
  const blocks = useQuerySubscription(timeBlocksQuery);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function check() {
      const enabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "true";
      if (!enabled) return;
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const todayBlocks = getTodayBlocks(blocks);

      for (let i = 0; i < todayBlocks.length; i++) {
        const block = todayBlocks[i];
        if (!block.end) continue;

        const endTime = new Date(block.end as string);
        const minutesLeft = (endTime.getTime() - now.getTime()) / 60_000;

        // Notify NOTIFICATION_LEAD_MINUTES before end, but only once per block
        const notifKey = `end-${block.id}`;
        if (minutesLeft > 0 && minutesLeft <= NOTIFICATION_LEAD_MINUTES && !notifiedRef.current.has(notifKey)) {
          notifiedRef.current.add(notifKey);
          const nextBlock = todayBlocks[i + 1];
          const body = nextBlock
            ? `Dál: ${String(nextBlock.title ?? "")}`
            : "Žádný další blok dnes.";
          showNotification(
            `Za ${Math.ceil(minutesLeft)} min konec: ${String(block.title ?? "")}`,
            body,
          );
        }
      }
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [blocks]);
}

export { requestPermissionIfNeeded };
