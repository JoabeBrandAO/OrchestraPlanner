"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { fieldValue, hasText } from "@/lib/form";
import { trpc } from "@/trpc/react";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const CIRCLE_KINDS = [
  { value: "familia", label: "Família" },
  { value: "celula", label: "Célula" },
  { value: "amigos", label: "Amigos" },
  { value: "mentores", label: "Mentores" },
  { value: "outro", label: "Outro" },
] as const;

type CircleKind = (typeof CIRCLE_KINDS)[number]["value"];

/**
 * Círculos (#42): família, célula, amigos, mentores. Cadastro na janela flutuante padrão;
 * os membros são geridos inline, dentro do card do círculo — é um select por vez, e modal
 * ali seria mais clique para menos.
 */
export function CirclesSection({ people }: { people: { id: string; name: string }[] }) {
  const utils = trpc.useUtils();
  const circles = trpc.circles.list.useQuery();
  const [creating, setCreating] = useState(false);

  const invalidate = () => utils.circles.list.invalidate();
  const createCircle = trpc.circles.create.useMutation({
    onSuccess: () => {
      setCreating(false);
      return invalidate();
    },
  });
  const deleteCircle = trpc.circles.delete.useMutation({ onSuccess: invalidate });
  const addMember = trpc.circles.addMember.useMutation({ onSuccess: invalidate });
  const removeMember = trpc.circles.removeMember.useMutation({ onSuccess: invalidate });

  const busy = addMember.isPending || removeMember.isPending || deleteCircle.isPending;
  const hasCircles = (circles.data?.length ?? 0) > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Círculos</h2>
        {hasCircles && (
          <Button size="sm" onClick={() => setCreating(true)}>
            + Novo círculo
          </Button>
        )}
      </div>

      {circles.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando círculos…</p>
      ) : hasCircles ? (
        <ul className="flex flex-col gap-3">
          {circles.data!.map((circle) => (
            <li key={circle.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{circle.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {CIRCLE_KINDS.find((kind) => kind.value === circle.kind)?.label} ·{" "}
                    {circle.members.length} membro(s)
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  aria-label={`Remover círculo ${circle.name}`}
                  onClick={() => deleteCircle.mutate({ id: circle.id })}
                >
                  Remover
                </Button>
              </div>

              {circle.members.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {circle.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">
                        {member.name}
                        {member.role && (
                          <span className="text-muted-foreground"> · {member.role}</span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={`Tirar ${member.name} de ${circle.name}`}
                        onClick={() => removeMember.mutate({ id: member.id })}
                      >
                        Tirar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {people.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Cadastre pessoas para colocar neste círculo.
                </p>
              ) : (
                <form
                  className="mt-2 flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const personId = fieldValue(form, "personId");
                    if (!personId) return;

                    addMember.mutate({
                      circleId: circle.id,
                      personId,
                      role: fieldValue(form, "role").trim() || null,
                    });
                    form.reset();
                  }}
                >
                  <select
                    name="personId"
                    className={`${inputClass} w-auto`}
                    aria-label={`Pessoa para ${circle.name}`}
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="role"
                    className={`${inputClass} w-32`}
                    placeholder="papel"
                    aria-label={`Papel em ${circle.name}`}
                    maxLength={60}
                  />
                  <Button type="submit" size="sm" disabled={busy}>
                    Incluir
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum círculo ainda. Agrupe família, célula, amigos próximos ou mentores.
          </p>
          <Button size="sm" onClick={() => setCreating(true)}>
            + Novo círculo
          </Button>
        </div>
      )}

      <FormDialog open={creating} onOpenChange={setCreating} title="Novo círculo">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (!hasText(form, "name")) return;

            createCircle.mutate({
              name: fieldValue(form, "name").trim(),
              kind: fieldValue(form, "kind") as CircleKind,
              notes: fieldValue(form, "notes").trim() || null,
            });
          }}
        >
          <input
            name="name"
            className={inputClass}
            placeholder="Nome do círculo"
            aria-label="Nome do círculo"
            maxLength={120}
          />
          <label className="text-muted-foreground flex flex-col gap-1 text-xs">
            Tipo
            <select name="kind" className={inputClass} defaultValue="outro">
              {CIRCLE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            name="notes"
            className={inputClass}
            placeholder="Notas (opcional)"
            aria-label="Notas do círculo"
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={createCircle.isPending}>
              {createCircle.isPending ? "Criando…" : "Criar círculo"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            {createCircle.error && (
              <span className="text-sm text-red-500">{createCircle.error.message}</span>
            )}
          </div>
        </form>
      </FormDialog>
    </section>
  );
}
