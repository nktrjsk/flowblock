import { evolu } from "../db/evolu";
import { TaskId } from "../db/schema";
import * as Evolu from "@evolu/common";

export type TaskStatus = "inbox" | "planned" | "done" | "someday";
export type TaskPriority = "none" | "low" | "medium" | "high";

export function setTaskStatus(id: TaskId, status: TaskStatus): void {
  evolu.update("task", { id, status: Evolu.NonEmptyString100.orThrow(status) });
}

export function setTaskPriority(id: TaskId, priority: TaskPriority): void {
  evolu.update("task", { id, priority: Evolu.NonEmptyString100.orThrow(priority) });
}
