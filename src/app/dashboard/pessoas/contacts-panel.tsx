"use client";

import type { inferRouterOutputs } from "@trpc/server";

import {
  CONTACT_KIND_LABELS,
  CONTACT_KINDS,
  type ContactKindValue,
} from "@/server/services/people/person-fields";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { fieldValue } from "@/lib/form";

type Contact = inferRouterOutputs<AppRouter>["people"]["list"][number]["contacts"][number];

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  contacts: Contact[];
  busy: boolean;
  onAdd: (contact: { kind: ContactKindValue; label: string | null; value: string }) => void;
  onRemove: (id: string) => void;
};

/**
 * Contatos de uma pessoa (#41). Fica **inline**, e não numa janela: é um campo só por
 * linha, dentro de um painel que o usuário já abriu — modal aqui seria mais clique para
 * menos (mesmo critério dos marcos e das tags).
 */
export function ContactsPanel({ contacts, busy, onAdd, onRemove }: Props) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum contato ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0 text-xs">
                {CONTACT_KIND_LABELS[contact.kind]}
                {contact.label && ` · ${contact.label}`}
              </span>
              <span className="flex-1 text-sm break-all">{contact.value}</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Remover contato ${contact.value}`}
                onClick={() => onRemove(contact.id)}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const value = fieldValue(form, "value").trim();
          if (value === "") return;

          onAdd({
            kind: fieldValue(form, "kind") as ContactKindValue,
            label: fieldValue(form, "label").trim() || null,
            value,
          });
          form.reset();
        }}
      >
        <select name="kind" className={`${inputClass} w-auto`} aria-label="Tipo de contato">
          {CONTACT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CONTACT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <input
          name="label"
          className={`${inputClass} w-28`}
          placeholder="rótulo"
          aria-label="Rótulo do contato"
          maxLength={60}
        />
        <input
          name="value"
          className={`${inputClass} min-w-40 flex-1`}
          placeholder="Telefone, e-mail, endereço…"
          aria-label="Contato"
          maxLength={300}
        />
        <Button type="submit" size="sm" disabled={busy}>
          Adicionar
        </Button>
      </form>
    </div>
  );
}
