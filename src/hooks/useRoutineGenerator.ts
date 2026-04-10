import { useEffect } from "react";
import {
  runRoutineGeneration,
  triggerRoutineGeneration,
} from "../services/routineGenerator";

export { deleteFutureBlocksForTemplate, triggerRoutineGeneration } from "../services/routineGenerator";

export function useRoutineGenerator() {
  useEffect(() => {
    runRoutineGeneration();

    function handleVisibility() {
      if (!document.hidden) triggerRoutineGeneration();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
