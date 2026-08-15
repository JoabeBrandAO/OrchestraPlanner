"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { AreaForm, DIMENSIONS } from "./area-form";

export function AreasManager() {
  const utils = trpc.useUtils();
  const areas = trpc.lifeAreas.list.useQuery();
  const invalidate = () => utils.lifeAreas.list.invalidate();

  const [creating, setCreating] = useState(false);

  const create = trpc.lifeAreas.create.useMutation({
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    },
  });
  const remove = trpc.lifeAreas.delete.useMutation({ onSuccess: invalidate });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          + Nova área
        </Button>
      </div>

      <FormDialog open={creating} onOpenChange={setCreating} title="Nova área de vida">
        <AreaForm
          pending={create.isPending}
          error={create.error?.message}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      </FormDialog>

      {areas.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando áreas…</p>
      ) : (
        DIMENSIONS.map((d) => {
          const items = areas.data?.filter((a) => a.dimension === d.value) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={d.value}>
              <h2 className="text-muted-foreground mb-2 text-sm font-medium uppercase">
                {d.label}
              </h2>
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
