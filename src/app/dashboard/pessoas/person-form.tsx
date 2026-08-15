"use client";

import { useState } from "react";

import {
  acceptsMarriageDate,
  GENDER_LABELS,
  GENDERS,
  MARITAL_STATUS_LABELS,
  MARITAL_STATUSES,
  MONTH_LABELS,
  RELATION_TYPE_LABELS,
  RELATION_TYPES,
  type MaritalStatusValue,
} from "@/server/services/people/person-fields";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";

import {
  checkPersonFields,
  parsePersonFields,
  type PersonFormValues,
  type PersonStatus,
  type RawPersonFields,
} from "./person-input";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type AreaOption = { id: string; name: string };

type Props = {
  areas: AreaOption[];
  pending: boolean;
  error?: string | null;
  initial?: PersonFormValues;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: PersonFormValues) => void;
  onCancel: () => void;
};

function readFields(form: HTMLFormElement): RawPersonFields {
  const value = (name: string) => fieldValue(form, name);
  return {
    name: value("name"),
    nickname: value("nickname"),
    birthDay: value("birthDay"),
    birthMonth: value("birthMonth"),
    birthYear: value("birthYear"),
    gender: value("gender"),
    maritalStatus: value("maritalStatus"),
    marriedAt: value("marriedAt"),
    relationType: value("relationType"),
    lifeAreaId: value("lifeAreaId"),
    notes: value("notes"),
  };
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/**
 * Cadastro de pessoa (#41), no formulário não controlado padrão do app: o estado guarda só
 * o veredito e o estado civil.
 *
 * O estado civil precisa de estado porque **decide o que aparece**: a data de casamento só
 * existe para casado/união estável (decisão #25). É uma troca por vez, num `<select>` —
 * nada a ver com o custo por tecla que motivou o padrão não controlado.
 */
export function PersonForm({
  areas,
  pending,
  error,
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatusValue>(
    initial?.maritalStatus ?? "nao_informado",
  );
  const [status, setStatus] = useState<PersonStatus>({
    canSubmit: (initial?.name ?? "").trim() !== "",
    invalidBirthday: false,
  });

  const revalidate = (event: React.FormEvent<HTMLFormElement>) => {
    const next = checkPersonFields(readFields(event.currentTarget));
    setStatus((current) =>
      current.canSubmit === next.canSubmit && current.invalidBirthday === next.invalidBirthday
        ? current
        : next,
    );
  };

  return (
    <form
      className="flex flex-col gap-3"
      onChange={revalidate}
      onSubmit={(event) => {
        event.preventDefault();
        const values = parsePersonFields(readFields(event.currentTarget));
        if (values !== null) onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          className={inputClass}
          placeholder="Nome"
          aria-label="Nome"
          maxLength={120}
          defaultValue={initial?.name ?? ""}
        />
        <input
          name="nickname"
          className={inputClass}
          placeholder="Apelido (opcional)"
          aria-label="Apelido"
          maxLength={120}
          defaultValue={initial?.nickname ?? ""}
        />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-muted-foreground mb-1 text-xs">Aniversário</legend>
        <select
          name="birthDay"
          className={inputClass}
          aria-label="Dia do aniversário"
          defaultValue={initial?.birthday?.day ?? ""}
        >
          <option value="">Dia</option>
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <select
          name="birthMonth"
          className={inputClass}
          aria-label="Mês do aniversário"
          defaultValue={initial?.birthday?.month ?? ""}
        >
          <option value="">Mês</option>
          {MONTH_LABELS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="birthYear"
          type="number"
          className={inputClass}
          placeholder="Ano (se souber)"
          aria-label="Ano do aniversário"
          defaultValue={initial?.birthday?.year ?? ""}
        />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Gênero
          <select
            name="gender"
            className={inputClass}
            defaultValue={initial?.gender ?? "nao_informado"}
          >
            {GENDERS.map((option) => (
              <option key={option} value={option}>
                {GENDER_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Tipo de relação
          <select
            name="relationType"
            className={inputClass}
            defaultValue={initial?.relationType ?? "outro"}
          >
            {RELATION_TYPES.map((option) => (
              <option key={option} value={option}>
                {RELATION_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          Estado civil
          <select
            name="maritalStatus"
            className={inputClass}
            defaultValue={maritalStatus}
            onChange={(event) => setMaritalStatus(event.target.value as MaritalStatusValue)}
          >
            {MARITAL_STATUSES.map((option) => (
              <option key={option} value={option}>
                {MARITAL_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        {/* Só para quem o estado civil comporta (decisão #25). */}
        {acceptsMarriageDate(maritalStatus) && (
          <label className="text-muted-foreground flex flex-col gap-1 text-xs">
            Data de casamento
            <input
              name="marriedAt"
              type="date"
              className={inputClass}
              defaultValue={initial?.marriedAt ?? ""}
            />
          </label>
        )}
      </div>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs">
        Área de vida
        <select name="lifeAreaId" className={inputClass} defaultValue={initial?.lifeAreaId ?? ""}>
          <option value="">{areas.length > 0 ? "Sem área" : "Nenhuma área ainda"}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      <textarea
        name="notes"
        className={inputClass}
        placeholder="Notas (opcional)"
        aria-label="Notas"
        rows={2}
        defaultValue={initial?.notes ?? ""}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!status.canSubmit || pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        {status.invalidBirthday && (
          <span className="text-muted-foreground text-sm">Essa data não existe no calendário.</span>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
