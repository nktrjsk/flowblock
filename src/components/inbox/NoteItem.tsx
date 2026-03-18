import { FileText, ArrowRight, Archive, Trash2 } from "lucide-react";
import { useEvolu } from "../../db/evolu";
import { NoteId, TaskId } from "../../db/schema";
import * as Evolu from "@evolu/common";

interface NoteItemProps {
  id: NoteId;
  content: string;
}

export default function NoteItem({ id, content }: NoteItemProps) {
  const { insert, update } = useEvolu();

  function handleConvert() {
    const firstLine = content.split("\n")[0].trim();
    const titleResult = Evolu.NonEmptyString1000.from(firstLine || content);
    if (!titleResult.ok) return;
    const result = insert("task", {
      title: titleResult.value,
      status: Evolu.NonEmptyString100.orThrow("inbox"),
      priority: Evolu.NonEmptyString100.orThrow("none"),
      energy: Evolu.NonEmptyString100.orThrow("normal"),
    });
    if (result.ok) {
      update("note", {
        id,
        status: Evolu.NonEmptyString100.orThrow("reviewed"),
        converted_task_id: result.value.id as unknown as TaskId,
      });
    }
  }

  function handleArchive() {
    update("note", { id, status: Evolu.NonEmptyString100.orThrow("reviewed") });
  }

  function handleDelete() {
    update("note", { id, isDeleted: 1 });
  }

  return (
    <div className="group flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-ink/5 transition-colors">
      <FileText size={13} className="mt-0.5 shrink-0 text-ink/35" />
      <span className="flex-1 text-sm text-ink/60 leading-snug line-clamp-2">{content}</span>
      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleConvert}
          title="Konvertovat na úkol"
          className="p-1 rounded hover:bg-ink/10 text-ink/40 hover:text-ink/70 transition-colors"
        >
          <ArrowRight size={12} />
        </button>
        <button
          onClick={handleArchive}
          title="Archivovat"
          className="p-1 rounded hover:bg-ink/10 text-ink/40 hover:text-ink/70 transition-colors"
        >
          <Archive size={12} />
        </button>
        <button
          onClick={handleDelete}
          title="Smazat"
          className="p-1 rounded hover:bg-ink/10 text-ink/40 hover:text-red-500 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
