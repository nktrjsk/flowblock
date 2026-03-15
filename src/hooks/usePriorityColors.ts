import { useTheme } from "../contexts/ThemeContext";
import { PRIORITY_COLORS, PRIORITY_COLORS_DARK, type Priority } from "../constants";

export function usePriorityColors() {
  const { effectiveTheme } = useTheme();
  return effectiveTheme === "dark" ? PRIORITY_COLORS_DARK : PRIORITY_COLORS;
}

export function getPriorityColors(priority: string | null, dark: boolean) {
  const prio = (priority ?? "none") as Priority;
  const map = dark ? PRIORITY_COLORS_DARK : PRIORITY_COLORS;
  return map[prio] ?? map.none;
}
