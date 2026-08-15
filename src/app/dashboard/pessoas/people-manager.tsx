"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import { ageOn, nextBirthday } from "@/server/services/people/birthday";
import { byMostForgotten, describeGap } from "@/server/services/people/contact-gap";
import { MONTH_LABELS, RELATION_TYPE_LABELS } from "@/server/services/people/person-fields";
import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { CirclesSection } from "./circles-section";
import { ContactsPanel } from "./contacts-panel";
import { InteractionsPanel } from "./interactions-panel";
import { LinksPanel } from "./links-panel";
import { PersonForm } from "./person-form";
import { type PersonFormValues } from "./person-input";

type Person = inferRouterOutputs<AppRouter>["people"]["list"][number];
type Panel = "contatos" | "vinculos" | "convivio";
type Ordem = "nome" | "esquecidos";

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
  /** Qual painel está aberto e de quem — só um por vez mantém a lista legível. */
  const [openPanel, setOpenPanel] = useState<{ id: string; kind: Panel } | null>(null);
  const isOpen = (id: string, kind: Panel) => openPanel?.id === id && openPanel.kind === kind;
  const toggle = (id: string, kind: Panel) =>
    setOpenPanel((current) => (current?.id === id && current.kind === kind ? null : { id, kind }));
  /** Ordem da lista: alfabética para achar alguém, "esquecidos" para saber quem procurar. */
  const [ordem, setOrdem] = useState<Ordem>("nome");

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
  // A ordenação é do client: a lista é pequena e trocar a ordem não deve ir ao servidor.
  const lista = [...(people.data ?? [])].sort(
    ordem === "nome" ? (a, b) => a.name.localeCompare(b.name, "pt-BR") : byMostForgotten,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Some quando não há ninguém: ali o estado vazio já é o convite, e dois botões
          iguais na mesma tela fazem o usuário se perguntar qual é o certo. */}
      {hasPeople && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">{people.data?.length} pessoa(s)</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={ordem === "nome" ? "default" : "ghost"}
              aria-pressed={ordem === "nome"}
              onClick={() => setOrdem("nome")}
            >
              Por nome
            </Button>
            <Button
              size="sm"
              variant={ordem === "esquecidos" ? "default" : "ghost"}
              aria-pressed={ordem === "esquecidos"}
              onClick={() => setOrdem("esquecidos")}
            >
              Há mais tempo sem contato
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              + Nova pessoa
            </Button>
          </div>
        </div>
      )}

      {people.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando pessoas…</p>
      ) : people.data && people.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {lista.map((item) => (
            <li key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.name}
                    {item.nickname && (
                      <span className="text-muted-foreground font-normal"> ({item.nickname})</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {resumo(item, today)} · {describeGap(item.lastInteractionAt, today)}
                  </p>
                  {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={isOpen(item.id, "contatos")}
                    onClick={() => toggle(item.id, "contatos")}
                  >
                    {isOpen(item.id, "contatos")
                      ? "Ocultar contatos"
                      : `Contatos (${item.contacts.length})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={isOpen(item.id, "vinculos")}
                    onClick={() => toggle(item.id, "vinculos")}
                  >
                    {isOpen(item.id, "vinculos") ? "Ocultar vínculos" : "Vínculos"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={isOpen(item.id, "convivio")}
                    onClick={() => toggle(item.id, "convivio")}
                  >
                    {isOpen(item.id, "convivio") ? "Ocultar convívio" : "Convívio"}
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

              {isOpen(item.id, "contatos") && (
                <ContactsPanel
                  contacts={item.contacts}
                  busy={busy}
                  onAdd={(contact) => addContact.mutate({ personId: item.id, ...contact })}
                  onRemove={(id) => deleteContact.mutate({ id })}
                />
              )}

              {isOpen(item.id, "convivio") && (
                <InteractionsPanel personId={item.id} today={today} />
              )}

              {isOpen(item.id, "vinculos") && (
                <LinksPanel
                  personId={item.id}
                  personName={item.name}
                  candidates={(people.data ?? [])
                    .filter((outra) => outra.id !== item.id)
                    .map((outra) => ({ id: outra.id, name: outra.name }))}
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

      <CirclesSection
        people={(people.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
      />
    </div>
  );
}
