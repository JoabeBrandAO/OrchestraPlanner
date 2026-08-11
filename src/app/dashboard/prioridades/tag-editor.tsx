"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { TAG_NAME_MAX_LENGTH } from "@/server/services/tags/tag-name";
import { trpc } from "@/trpc/react";

type TagLike = { id: string; name: string; color: string | null };

/**
 * Editor de tags de uma prioridade (#14). Autocomplete sobre as tags existentes
 * (`<datalist>` — nativo, acessível e sem dependência) e criação ao digitar um nome novo:
 * `tags.create` é idempotente, então "já existe" simplesmente reaproveita a tag.
 */
export function TagEditor({
  priorityId,
  selected,
  onClose,
}: {
  priorityId: string;
  selected: TagLike[];
  onClose: () => void;
}) {
  const listId = useId();
  const utils = trpc.useUtils();
  const tags = trpc.tags.list.useQuery();

  const [draft, setDraft] = useState("");
  const [ids, setIds] = useState<string[]>(selected.map((tag) => tag.id));

  const known = tags.data ?? [];
  const chosen = ids
    .map((id) => known.find((tag) => tag.id === id) ?? selected.find((tag) => tag.id === id))
    .filter((tag): tag is TagLike => Boolean(tag));

  const createTag = trpc.tags.create.useMutation({
    onSuccess: async (tag) => {
      setDraft("");
      setIds((current) => (current.includes(tag.id) ? current : [...current, tag.id]));
      await utils.tags.list.invalidate();
    },
  });

  const setForPriority = trpc.tags.setForPriority.useMutation({
    onSuccess: async () => {
      await utils.priorities.list.invalidate();
      onClose();
    },
  });

  const busy = createTag.isPending || setForPriority.isPending;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2">
      <div className="flex flex-wrap gap-1">
        {chosen.length === 0 && <span className="text-muted-foreground text-xs">Sem tags.</span>}
        {chosen.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="rounded-full border px-2 py-0.5 text-xs"
            style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            onClick={() => setIds((current) => current.filter((id) => id !== tag.id))}
            aria-label={`Remover tag ${tag.name}`}
          >
            {tag.name} ×
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          list={listId}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-w-40 flex-1 rounded-lg border px-2 py-1 text-sm outline-none focus-visible:ring-3"
          placeholder="Adicionar tag…"
          value={draft}
          maxLength={TAG_NAME_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            // Já existe? só seleciona. Se não, cria (o serviço é idempotente de qualquer forma).
            const existing = known.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
            if (existing) {
              setIds((current) =>
                current.includes(existing.id) ? current : [...current, existing.id],
              );
              setDraft("");
            } else {
              createTag.mutate({ name });
            }
          }}
        />
        <datalist id={listId}>
          {known.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>

        <Button
          size="sm"
          disabled={busy}
          onClick={() => setForPriority.mutate({ priorityId, tagIds: ids })}
        >
          {setForPriority.isPending ? "Salvando…" : "Salvar tags"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
      </div>

      {(createTag.error ?? setForPriority.error) && (
        <span className="text-xs text-red-500">
          {createTag.error?.message ?? setForPriority.error?.message}
        </span>
      )}
    </div>
  );
}
