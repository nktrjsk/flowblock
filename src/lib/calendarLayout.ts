/**
 * Calendar collision layout — assigns each block a column index and total
 * column count for visual side-by-side rendering of overlapping blocks.
 *
 * Pure function — no React/DOM dependencies, fully testable in isolation.
 */

export interface LayoutBlock {
  id: unknown;
  startMinutes: number;
  durationMinutes: number;
}

export interface LayoutResult {
  col: number;
  totalCols: number;
}

/**
 * Computes side-by-side layout for a set of time blocks within a single day.
 *
 * Algorithm:
 *   1. Sort blocks by start time (id as tiebreaker for stability).
 *   2. Sweepline: assign each block the lowest column index whose previous
 *      occupant has already ended.
 *   3. For each block, compute `totalCols` as 1 + the maximum column index
 *      among all blocks that overlap with it (transitively through the
 *      collision group).
 *
 * Returns a Map keyed by `String(block.id)` → `{ col, totalCols }`.
 */
export function computeCollisionLayout(
  blocks: ReadonlyArray<LayoutBlock>,
): Map<string, LayoutResult> {
  const result = new Map<string, LayoutResult>();
  if (!blocks.length) return result;

  // Sort by start time, ID as tiebreaker for deterministic output
  const sorted = [...blocks].sort((a, b) =>
    a.startMinutes !== b.startMinutes
      ? a.startMinutes - b.startMinutes
      : String(a.id) < String(b.id) ? -1 : 1,
  );

  const colEnds: number[] = [];
  const blockColMap = new Map<string, number>();

  for (const b of sorted) {
    const end = b.startMinutes + b.durationMinutes;
    let c = colEnds.findIndex((t) => t <= b.startMinutes);
    if (c === -1) c = colEnds.length;
    colEnds[c] = end;
    blockColMap.set(String(b.id), c);
  }

  for (const b of sorted) {
    const bEnd = b.startMinutes + b.durationMinutes;
    let maxCol = blockColMap.get(String(b.id))!;
    for (const other of sorted) {
      if (String(other.id) === String(b.id)) continue;
      const oEnd = other.startMinutes + other.durationMinutes;
      if (b.startMinutes < oEnd && bEnd > other.startMinutes) {
        maxCol = Math.max(maxCol, blockColMap.get(String(other.id))!);
      }
    }
    result.set(String(b.id), {
      col: blockColMap.get(String(b.id))!,
      totalCols: maxCol + 1,
    });
  }

  return result;
}
