"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DimensionDot } from "@/components/ui/dimension-dot";
import { FormDialog } from "@/components/ui/form-dialog";
import { DIMENSION_STYLE } from "@/lib/dimension-style";
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
  /**
   * Área à espera de confirmação. Remover apaga as notas dela no histórico da Roda da Vida
   * (`life_assessments` em cascata) e deixa metas e pessoas ligadas a ela sem área.
   */
  const [removendo, setRemovendo] = useState<{ id: string; name: string } | null>(null);
  const remove = trpc.lifeAreas.delete.useMutation({
    onSuccess: async () => {
      setRemovendo(null);
      await invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Nova área
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

      <ConfirmDialog
        open={removendo !== null}
        onOpenChange={(open) => !open && setRemovendo(null)}
        title={`Remover a área ${removendo?.name ?? ""}?`}
        description={
          <>
            <strong>As notas desta área em todas as suas Rodas da Vida são apagadas</strong>, e o
            histórico perde essa linha. Metas, compromissos, pessoas e lançamentos ligados a ela
            continuam, só que sem área. Não dá para desfazer.
          </>
        }
        confirmLabel="Remover área"
        pendingLabel="Removendo…"
        pending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => removendo && remove.mutate({ id: removendo.id })}
      />

      {areas.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando áreas…</p>
      ) : (
        DIMENSIONS.map((d) => {
          const items = areas.data?.filter((a) => a.dimension === d.value) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={d.value}>
              <h2
                className={`mb-2 flex items-center gap-2 text-sm font-medium uppercase ${DIMENSION_STYLE[d.value].text}`}
              >
                <DimensionDot dimension={d.value} />
                {d.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((area) => (
                  <li
                    key={area.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <DimensionDot dimension={area.dimension} />
                      {area.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remover a área ${area.name}`}
                      onClick={() => {
                        remove.reset();
                        setRemovendo({ id: area.id, name: area.name });
                      }}
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
