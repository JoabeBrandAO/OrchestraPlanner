"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import { ageOn, nextBirthday } from "@/server/services/people/birthday";
import { MONTH_LABELS, RELATION_TYPE_LABELS } from "@/server/services/people/person-fields";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { ContactsPanel } from "./contacts-panel";
import { PersonForm } from "./person-form";
import { type PersonFormValues } from "./person-input";

type Person = inferRouterOutputs<AppRouter>["people"]["list"][number];

/** Como a pessoa é descrita numa linha: aniversário, idade e a relação. */
function resumo(person: Person, today: Date): string {
  const partes: string[] = [RELATION_TYPE_LABELS[person.relationType]];

  if (person.birthDay && person.birthMonth) {
    const birthday = { day: person.birthDay, month: person.birthMonth, year: person.birthYear };
    const idade = ageOn(birthday, today);
    const proximo = nextBirthday(birthday, today);
    const dias = Math.round((proximo.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    partes.push(
      `${person.birthDay} de ${MONTH_LABELS[person.birthMonth - 1]}` +
        // Sem o ano não há idade — mostrar uma seria pior do que não mostrar.
        (idade === null ? "" : ` · ${idade} anos`) +
        (dias === 0 ? " · é hoje 🎂" : dias <= 30 ? ` · em ${dias} dia(s)` : ""),
    );
  }

  return partes.join(" · ");
}

/**
 * Pessoas & Relacionamentos (#41) — lista, cadastro em janela flutuante e contatos por
 * pessoa. Segue o padrão de "novo registro" das demais telas.
 */
export function PeopleManager() {
  const utils = trpc.useUtils();
  const people = trpc.people.list.useQuery();
  const areas = trpc.lifeAreas.list.useQuery();

  const [editing, setEditing] = useState<"new" | Person | null>(null);
  const [openContacts, setOpenContacts] = useState<string | null>(null);

  const today = new Date();
  const invalidate = () => utils.people.list.invalidate();
  const close = () => {
    invalidate();
    setEditing(null);
  };

  const createPerson = trpc.people.create.useMutation({ onSuccess: close });
  const updatePerson = trpc.people.update.useMutation({ onSuccess: close });
  const deletePerson = trpc.people.delete.useMutation({ onSuccess: invalidate });
  const addContact = trpc.people.addContact.useMutation({ onSuccess: invalidate });
  const deleteContact = trpc.people.deleteContact.useMutation({ onSuccess: invalidate });

  const person = editing === "new" ? null : editing;
  const busy = addContact.isPending || deleteContact.isPending || deletePerson.isPending;
  const hasPeople = (people.data?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Some quando não há ninguém: ali o estado vazio já é o convite, e dois botões
          iguais na mesma tela fazem o usuário se perguntar qual é o certo. */}
      {hasPeople && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{people.data?.length} pessoa(s)</span>
          <Button size="sm" onClick={() => setEditing("new")}>
            + Nova pessoa
          </Button>
        </div>
      )}

      {people.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando pessoas…</p>
      ) : people.data && people.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {people.data.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.name}
                    {item.nickname && (
                      <span className="text-muted-foreground font-normal"> ({item.nickname})</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">{resumo(item, today)}</p>
                  {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={openContacts === item.id}
                    onClick={() =>
                      setOpenContacts((current) => (current === item.id ? null : item.id))
                    }
                  >
                    {openContacts === item.id
                      ? "Ocultar contatos"
                      : `Contatos (${item.contacts.length})`}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    aria-label={`Remover ${item.name}`}
                    onClick={() => deletePerson.mutate({ id: item.id })}
                  >
                    Remover
                  </Button>
                </div>
              </div>

              {openContacts === item.id && (
                <ContactsPanel
                  contacts={item.contacts}
                  busy={busy}
                  onAdd={(contact) => addContact.mutate({ personId: item.id, ...contact })}
                  onRemove={(id) => deleteContact.mutate({ id })}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Ninguém cadastrado ainda. Comece pelas pessoas que você mais quer acompanhar. 👥
          </p>
          <Button size="sm" onClick={() => setEditing("new")}>
            + Nova pessoa
          </Button>
        </div>
      )}

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={person ? "Editar pessoa" : "Nova pessoa"}
      >
        <PersonForm
          key={person?.id ?? "nova"}
          areas={areas.data ?? []}
          pending={person ? updatePerson.isPending : createPerson.isPending}
          error={person ? updatePerson.error?.message : createPerson.error?.message}
          submitLabel={person ? "Salvar" : "Cadastrar"}
          pendingLabel={person ? "Salvando…" : "Cadastrando…"}
          initial={
            person
              ? {
                  name: person.name,
                  nickname: person.nickname,
                  birthday:
                    person.birthDay && person.birthMonth
                      ? {
                          day: person.birthDay,
                          month: person.birthMonth,
                          year: person.birthYear,
                        }
                      : null,
                  gender: person.gender,
                  maritalStatus: person.maritalStatus,
                  marriedAt: person.marriedAt,
                  relationType: person.relationType,
                  lifeAreaId: person.lifeAreaId,
                  notes: person.notes,
                }
              : undefined
          }
          onCancel={() => setEditing(null)}
          onSubmit={(values: PersonFormValues) =>
            person ? updatePerson.mutate({ id: person.id, ...values }) : createPerson.mutate(values)
          }
        />
      </FormDialog>
    </div>
  );
}
