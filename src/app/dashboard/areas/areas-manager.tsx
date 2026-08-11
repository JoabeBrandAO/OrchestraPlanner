"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/react";

const DIMENSIONS = [
  { value: "corpo", label: "Corpo" },
  { value: "alma", label: "Alma" },
  { value: "espirito", label: "Espírito" },
] as const;

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AreasManager() {
  const utils = trpc.useUtils();
  const areas = trpc.lifeAreas.list.useQuery();
  const invalidate = () => utils.lifeAreas.list.invalidate();

  const [name, setName] = useState("");
  const [dimension, setDimension] = useState<(typeof DIMENSIONS)[number]["value"]>("corpo");

  const create = trpc.lifeAreas.create.useMutation({
    onSuccess: async () => {
      setName("");
      await invalidate();
    },
  });
  const remove = trpc.lifeAreas.delete.useMutation({ onSuccess: invalidate });

  const nameValid = name.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameValid) return;
          create.mutate({ name, dimension });
        }}
      >
        <div className="flex-1">
          <label className="text-muted-foreground mb-1 block text-xs">Nova área</label>
          <input
            className={inputClass}
            placeholder="Nome da área"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <select
          className={inputClass + " w-auto"}
          value={dimension}
          onChange={(e) => setDimension(e.target.value as typeof dimension)}
        >
          {DIMENSIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!nameValid || create.isPending}>
          Adicionar
        </Button>
      </form>

      {areas.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando áreas…</p>
      ) : (
        DIMENSIONS.map((d) => {
          const items = areas.data?.filter((a) => a.dimension === d.value) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={d.value}>
              <h2 className="text-muted-foreground mb-2 text-sm font-medium uppercase">{d.label}</h2>
              <ul className="flex flex-col gap-2">
                {items.map((area) => (
                  <li
                    key={area.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-sm">{area.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: area.id })}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
