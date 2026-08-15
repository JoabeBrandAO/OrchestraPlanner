"use client";

import { RELATION_LABELS, RELATIONS, type RelationValue } from "@/server/services/people/relations";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";
import { trpc } from "@/trpc/react";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  personId: string;
  personName: string;
  /** Todas as outras pessoas — a própria fica de fora, ninguém se vincula a si mesmo. */
  candidates: { id: string; name: string }[];
};

/**
 * Vínculos de uma pessoa (#42). Só monta quando o painel é aberto, então a lista de
 * pessoas não dispara N consultas de uma vez — mesmo cuidado do painel de marcos.
 *
 * A relação é dita **do ponto de vista de quem está aberto**: "é ___ desta pessoa". O
 * outro lado é derivado do inverso, sem uma segunda linha para divergir.
 */
export function LinksPanel({ personId, personName, candidates }: Props) {
  const utils = trpc.useUtils();
  const links = trpc.circles.linksOf.useQuery({ personId });

  const invalidate = () => utils.circles.linksOf.invalidate();
  const link = trpc.circles.link.useMutation({ onSuccess: invalidate });
  const unlink = trpc.circles.unlink.useMutation({ onSuccess: invalidate });

  const busy = link.isPending || unlink.isPending;
  const error = link.error ?? unlink.error;

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      {links.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando vínculos…</p>
      ) : links.data && links.data.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {links.data.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  é {RELATION_LABELS[item.relation]} de {personName}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Desfazer vínculo com ${item.name}`}
                onClick={() => unlink.mutate({ id: item.id })}
              >
                Desfazer
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Nenhum vínculo ainda.</p>
      )}

      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Cadastre outra pessoa para poder criar um vínculo.
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const relatedPersonId = fieldValue(form, "relatedPersonId");
            if (!relatedPersonId) return;

            link.mutate({
              personId,
              relatedPersonId,
              relation: fieldValue(form, "relation") as RelationValue,
            });
            form.reset();
          }}
        >
          <select
            name="relatedPersonId"
            className={`${inputClass} w-auto`}
            aria-label="Pessoa a vincular"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <select name="relation" className={`${inputClass} w-auto`} aria-label="Relação">
            {RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                é {RELATION_LABELS[relation]} de {personName}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={busy}>
            Vincular
          </Button>
        </form>
      )}

      {error && <span className="text-sm text-red-500">{error.message}</span>}
    </div>
  );
}
