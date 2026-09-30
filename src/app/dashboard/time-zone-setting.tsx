"use client";

import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";
import { DEFAULT_TIME_ZONE } from "@/server/services/shared/time-zone";
import { trpc } from "@/trpc/react";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
}

/**
 * Fuso horário do usuário (#72). No primeiro acesso, o navegador semeia o fuso — o servidor
 * só grava se ainda não houver um, então isto nunca desfaz a escolha feita aqui. Depois, a
 * troca é explícita: quem viaja não fica preso ao fuso do primeiro acesso.
 */
export function TimeZoneSetting() {
  const utils = trpc.useUtils();
  const current = trpc.timeZone.get.useQuery();
  const seeded = useRef(false);

  const afterChange = () => {
    void utils.timeZone.get.invalidate();
    // O "hoje" do painel de metas depende do fuso.
    void utils.dashboard.goals.invalidate();
  };
  const seed = trpc.timeZone.seed.useMutation({ onSuccess: afterChange });
  const save = trpc.timeZone.set.useMutation({ onSuccess: afterChange });

  useEffect(() => {
    if (seeded.current || current.data !== null) return;
    seeded.current = true;
    seed.mutate({ timeZone: browserTimeZone() });
  }, [current.data, seed]);

  const options = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  if (current.isLoading) return null;
  const value = current.data ?? DEFAULT_TIME_ZONE;

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const timeZone = fieldValue(event.currentTarget, "timeZone");
        if (timeZone && timeZone !== value) save.mutate({ timeZone });
      }}
    >
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Fuso horário
        {/* `key` troca o campo quando o valor do servidor muda (ex.: a semeadura terminou). */}
        <select key={value} name="timeZone" className={inputClass} defaultValue={value}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : "Salvar fuso"}
      </Button>
      {save.error ? <p className="text-sm text-red-500">{save.error.message}</p> : null}
    </form>
  );
}
