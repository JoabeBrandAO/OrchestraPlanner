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

  const createTag = trpc.tags.create.useMutation();
  const setForPriority = trpc.tags.setForPriority.useMutation();

  const busy = createTag.isPending || setForPriority.isPending;

  /**
   * Transforma o texto digitado em tag selecionada e devolve a lista resultante.
   * Devolver (em vez de só chamar `setIds`) é o que permite salvar na mesma ação:
   * o estado do React só valeria no próximo render, e a tag se perderia.
   */
  async function commitDraft(): Promise<string[]> {
    const name = draft.trim();
    if (!name) return ids;

    const existing = known.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    const tag = existing ?? (await createTag.mutateAsync({ name }));

    const next = ids.includes(tag.id) ? ids : [...ids, tag.id];
    setIds(next);
    setDraft("");
    if (!existing) await utils.tags.list.invalidate();
    return next;
  }

  async function save() {
    const tagIds = await commitDraft();
    await setForPriority.mutateAsync({ priorityId, tagIds });
    await utils.priorities.list.invalidate();
    onClose();
  }

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
          placeholder="Digite uma tag e tecle Enter…"
          value={draft}
          maxLength={TAG_NAME_MAX_LENGTH}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void commitDraft();
          }}
        />
        <datalist id={listId}>
          {known.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>

        <Button
          size="sm"
          variant="outline"
          disabled={busy || draft.trim().length === 0}
          onClick={() => void commitDraft()}
        >
          {createTag.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {setForPriority.isPending ? "Salvando…" : "Salvar tags"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        A tag passa a existir assim que você a adiciona, e já aparece no filtro do topo. Clique num
        chip para tirá-lo desta prioridade.
      </p>

      {(createTag.error ?? setForPriority.error) && (
        <span className="text-xs text-red-500">
          {createTag.error?.message ?? setForPriority.error?.message}
        </span>
      )}
    </div>
  );
}
