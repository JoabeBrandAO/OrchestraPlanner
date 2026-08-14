"use client";

import { ProgressBar } from "@/components/ui/progress-bar";
import { trpc } from "@/trpc/react";

const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** "2026-01-31" (o `date` do Postgres) → "31 de jan.", sem passar por fuso horário. */
function formatIsoDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return dayFormat.format(new Date(year!, month! - 1, day!));
}

/** Painel do dashboard de metas (#16): números, distribuição por área e atividade. */
export function GoalsOverview() {
  const dashboard = trpc.dashboard.goals.useQuery();

  if (dashboard.isLoading) {
    return <p className="text-muted-foreground text-sm">Carregando seu panorama…</p>;
  }
  if (!dashboard.data) return null;

  const { summary, overdue, recent } = dashboard.data;

  if (summary.total === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Seu panorama aparece aqui assim que você criar a primeira meta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Ativas" value={summary.active} />
        <StatCard
          label="Vencidas"
          value={summary.overdue}
          tone={summary.overdue > 0 ? "alert" : undefined}
        />
        <StatCard label="Progresso médio" value={`${summary.averageProgress}%`} />
        <StatCard label="Concluídas" value={summary.completed} />
      </div>

      {overdue.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Passaram do prazo</h3>
          <ul className="flex flex-col gap-1">
            {overdue.map((goal) => (
              <li key={goal.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{goal.title}</span>
                <span className="text-destructive shrink-0 text-xs whitespace-nowrap">
                  {formatIsoDay(goal.targetDate)} · {goal.progress}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">Distribuição por área</h3>
        <ul className="flex flex-col gap-2">
          {summary.byArea.map((area) => (
            <li key={area.areaId ?? "sem-area"} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm">{area.name}</span>
              <ProgressBar
                value={area.averageProgress}
                label={`Progresso médio em ${area.name}`}
                className="flex-1"
              />
              <span className="text-muted-foreground w-24 shrink-0 text-right text-xs tabular-nums">
                {area.total === 0
                  ? "sem metas"
                  : `${area.completed}/${area.total} concluída${area.total > 1 ? "s" : ""}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Atividade recente</h3>
        <ul className="flex flex-col gap-1">
          {recent.map((entry) => (
            <li
              key={`${entry.kind}-${entry.id}`}
              className="text-muted-foreground flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">
                {entry.kind === "milestone" ? (
                  <>
                    Marco concluído: <span className="text-foreground">{entry.title}</span>
                    {entry.goalTitle && ` — ${entry.goalTitle}`}
                  </>
                ) : (
                  <>
                    Meta atualizada: <span className="text-foreground">{entry.title}</span>
                  </>
                )}
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap">
                {dayFormat.format(entry.at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "alert";
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          tone === "alert" ? "text-destructive text-2xl font-semibold" : "text-2xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
