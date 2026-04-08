import { describe, it, expect } from "vitest";
import { computeCollisionLayout } from "./calendarLayout";

describe("computeCollisionLayout", () => {
  it("returns empty map for no blocks", () => {
    const result = computeCollisionLayout([]);
    expect(result.size).toBe(0);
  });

  it("places single block in column 0 with totalCols 1", () => {
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 1 });
  });

  it("places non-overlapping blocks in column 0", () => {
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 120, durationMinutes: 60 },
      { id: "c", startMinutes: 240, durationMinutes: 60 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 1 });
    expect(result.get("b")).toEqual({ col: 0, totalCols: 1 });
    expect(result.get("c")).toEqual({ col: 0, totalCols: 1 });
  });

  it("places adjacent blocks (touching but not overlapping) in column 0", () => {
    // Block A ends exactly when B starts — should NOT be considered overlap
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 60, durationMinutes: 60 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 1 });
    expect(result.get("b")).toEqual({ col: 0, totalCols: 1 });
  });

  it("splits two overlapping blocks into two columns", () => {
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 30, durationMinutes: 60 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 2 });
    expect(result.get("b")).toEqual({ col: 1, totalCols: 2 });
  });

  it("places three mutually overlapping blocks in three columns", () => {
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 120 },
      { id: "b", startMinutes: 30, durationMinutes: 120 },
      { id: "c", startMinutes: 60, durationMinutes: 120 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 3 });
    expect(result.get("b")).toEqual({ col: 1, totalCols: 3 });
    expect(result.get("c")).toEqual({ col: 2, totalCols: 3 });
  });

  it("propagates totalCols across an L-shaped collision chain", () => {
    // A overlaps B, B overlaps C, but A does NOT overlap C.
    // All three are part of the same collision group, so totalCols should be 3
    // for B (which overlaps both), but A and C only overlap B (totalCols=2 each).
    // The current implementation sets totalCols based on direct overlaps only.
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 30, durationMinutes: 60 },
      { id: "c", startMinutes: 70, durationMinutes: 60 },
    ]);
    // A and B overlap; B reuses col 0; A goes to col 0 first
    expect(result.get("a")?.col).toBe(0);
    expect(result.get("b")?.col).toBe(1);
    // C does not overlap A — column 0 is free again, so C reuses col 0
    expect(result.get("c")?.col).toBe(0);
    // A overlaps only B, so totalCols=2; B overlaps both, totalCols=2 (max col is 1)
    expect(result.get("a")?.totalCols).toBe(2);
    expect(result.get("b")?.totalCols).toBe(2);
    expect(result.get("c")?.totalCols).toBe(2);
  });

  it("reuses freed columns for later non-overlapping blocks", () => {
    // A: 0-60, B: 30-90 → A col 0, B col 1
    // C: 100-160 → no overlap with anything → col 0
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 30, durationMinutes: 60 },
      { id: "c", startMinutes: 100, durationMinutes: 60 },
    ]);
    expect(result.get("a")).toEqual({ col: 0, totalCols: 2 });
    expect(result.get("b")).toEqual({ col: 1, totalCols: 2 });
    expect(result.get("c")).toEqual({ col: 0, totalCols: 1 });
  });

  it("produces deterministic output for blocks with identical start times", () => {
    // Same start time → tiebreaker is String(id) ascending
    const result1 = computeCollisionLayout([
      { id: "b", startMinutes: 0, durationMinutes: 60 },
      { id: "a", startMinutes: 0, durationMinutes: 60 },
    ]);
    const result2 = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 60 },
      { id: "b", startMinutes: 0, durationMinutes: 60 },
    ]);
    expect(result1.get("a")).toEqual(result2.get("a"));
    expect(result1.get("b")).toEqual(result2.get("b"));
    // "a" < "b" lexicographically → "a" gets col 0
    expect(result1.get("a")?.col).toBe(0);
    expect(result1.get("b")?.col).toBe(1);
  });

  it("handles a block fully contained within another", () => {
    // A: 0-180, B: 60-90 → both overlap
    const result = computeCollisionLayout([
      { id: "a", startMinutes: 0, durationMinutes: 180 },
      { id: "b", startMinutes: 60, durationMinutes: 30 },
    ]);
    expect(result.get("a")?.totalCols).toBe(2);
    expect(result.get("b")?.totalCols).toBe(2);
    expect(result.get("a")?.col).not.toBe(result.get("b")?.col);
  });

  it("coerces non-string id to string consistently", () => {
    const result = computeCollisionLayout([
      { id: 1, startMinutes: 0, durationMinutes: 60 },
      { id: 2, startMinutes: 30, durationMinutes: 60 },
    ]);
    expect(result.get("1")).toEqual({ col: 0, totalCols: 2 });
    expect(result.get("2")).toEqual({ col: 1, totalCols: 2 });
  });
});
