/**
 * Centralized Evolu queries.
 *
 * All queries are defined as module-level singletons and pre-loaded immediately.
 * This guarantees:
 *   - Subscription cache is shared across all consumers (one query → many subscribers)
 *   - Adding a column means updating one place
 *   - Filtering happens in JS (status, date ranges) — Evolu/SQLite is local, so
 *     this is essentially free for typical task/block volumes.
 *
 * Pattern: each query selects ALL columns (`selectAll()`) and only filters out
 * soft-deleted rows. Component-specific filtering is done in JS at the call site.
 */

import { evolu } from "./evolu";

// === Time blocks ===
export const allTimeBlocksQuery = evolu.createQuery((db) =>
  db
    .selectFrom("timeBlock")
    .selectAll()
    .where("isDeleted", "is", null)
    .orderBy("start", "asc"),
);
evolu.loadQuery(allTimeBlocksQuery);
