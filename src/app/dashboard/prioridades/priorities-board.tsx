"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { inferRouterOutputs } from "@trpc/server";
import { useMemo, useRef, useState } from "react";

import type { AppRouter } from "@/server/trpc/root";
import { Button } from "@/components/ui/button";
import {
  PRIORITY_STATUS_LABELS,
  PRIORITY_STATUSES,
  type PriorityStatusValue,
} from "@/server/services/priorities/priority-status";
import { trpc } from "@/trpc/react";

import { TagEditor } from "./tag-editor";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type PriorityItem = RouterOutputs["priorities"]["list"][number];
type Board = Record<PriorityStatusValue, PriorityItem[]>;

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const LEVEL_LABELS = ["Normal", "Média", "Alta", "Urgente"] as const;

const emptyBoard = (): Board => ({ todo: [], in_progress: [], done: [] });

/** Agrupa a lista (já ordenada pelo serviço) nas colunas do Kanban. */
function toBoard(items: PriorityItem[]): Board {
  const board = emptyBoard();
  for (const item of items) board[item.status].push(item);
  return board;
}

/** Volta o board para a forma da query (mesma ordem que o servidor devolveria). */
function toList(board: Board): PriorityItem[] {
  return PRIORITY_STATUSES.flatMap((status) =>
    board[status].map((item, position) => ({ ...item, status, position })),
  );
}

/** Descobre a coluna de um id — que pode ser um card ou a própria coluna (drop em vazio). */
function findColumn(board: Board, id: UniqueIdentifier): PriorityStatusValue | null {
  if (PRIORITY_STATUSES.includes(id as PriorityStatusValue)) return id as PriorityStatusValue;
  return PRIORITY_STATUSES.find((s) => board[s].some((item) => item.id === id)) ?? null;
}

export function PrioritiesBoard() {
  const utils = trpc.useUtils();

  const [goalFilter, setGoalFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const filter = useMemo(
    () => ({ goalId: goalFilter || undefined, tagId: tagFilter || undefined }),
    [goalFilter, tagFilter],
  );

  const priorities = trpc.priorities.list.useQuery(filter);
  const goals = trpc.goals.list.useQuery();
  const tags = trpc.tags.list.useQuery();

  // Fonte da verdade é o cache da query. Enquanto se arrasta, `dragBoard` segura o
  // preview local (o card não pode "pular" debaixo do cursor por causa de um refetch);
  // ao soltar, o resultado é escrito no próprio cache (otimista) e o preview é dispensado.
  const [dragBoard, setDragBoard] = useState<Board | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const dragOrigin = useRef<{ status: PriorityStatusValue; index: number } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const board = dragBoard ?? toBoard(priorities.data ?? []);

  const invalidate = () => utils.priorities.list.invalidate();

  const movePriority = trpc.priorities.move.useMutation({
    onError: (error) => setMoveError(error.message),
    onSettled: invalidate,
  });
  const createPriority = trpc.priorities.create.useMutation({ onSuccess: invalidate });
  const deletePriority = trpc.priorities.delete.useMutation({ onSuccess: invalidate });
  const updatePriority = trpc.priorities.update.useMutation({ onSuccess: invalidate });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Acessibilidade: mover card por teclado (espaço para pegar, setas, espaço para soltar).
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const from = findColumn(board, event.active.id);
    if (!from) return;
    dragOrigin.current = {
      status: from,
      index: board[from].findIndex((item) => item.id === event.active.id),
    };
    setDragBoard(board);
    setActiveId(event.active.id);
    setMoveError(null);
  }

  /** Move o card entre colunas durante o arrasto, para o board mostrar o destino real. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const from = findColumn(board, active.id);
    const to = findColumn(board, over.id);
    if (!from || !to || from === to) return;

    setDragBoard((current) => {
      const base = current ?? board;
      const moving = base[from].find((item) => item.id === active.id);
      if (!moving) return base;

      const overIndex = base[to].findIndex((item) => item.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : base[to].length;

      return {
        ...base,
        [from]: base[from].filter((item) => item.id !== active.id),
        [to]: [
          ...base[to].slice(0, insertAt),
          { ...moving, status: to },
          ...base[to].slice(insertAt),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setActiveId(null);
    setDragBoard(null);
    if (!over || !origin) return;

    const to = findColumn(board, over.id);
    if (!to) return;

    const overIndex = board[to].findIndex((item) => item.id === over.id);
    const currentIndex = board[to].findIndex((item) => item.id === active.id);
    const toIndex = overIndex >= 0 ? overIndex : Math.max(0, board[to].length - 1);

    if (origin.status === to && origin.index === toIndex) return;

    // Reordenação final dentro da coluna de destino (o `dragOver` já cuidou da troca)
    // gravada direto no cache: é o que mantém o card no lugar até o servidor confirmar.
    const settled: Board =
      currentIndex >= 0 && currentIndex !== toIndex
        ? { ...board, [to]: arrayMove(board[to], currentIndex, toIndex) }
        : board;
    utils.priorities.list.setData(filter, toList(settled));

    movePriority.mutate({ id: String(active.id), toStatus: to, toIndex });
  }

  const activeItem = activeId
    ? PRIORITY_STATUSES.flatMap((s) => board[s]).find((item) => item.id === activeId)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <NewPriorityForm
        goals={goals.data ?? []}
        pending={createPriority.isPending}
        error={createPriority.error?.message ?? null}
        onCreate={(input) => createPriority.mutate(input)}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={`${inputClass} max-w-56`}
          value={goalFilter}
          onChange={(e) => setGoalFilter(e.target.value)}
          aria-label="Filtrar por meta"
        >
          <option value="">Todas as metas</option>
          {goals.data?.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} max-w-56`}
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filtrar por tag"
        >
          <option value="">Todas as tags</option>
          {tags.data?.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        {(goalFilter || tagFilter) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setGoalFilter("");
              setTagFilter("");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {moveError && <p className="text-sm text-red-500">{moveError}</p>}

      {priorities.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando prioridades…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            dragOrigin.current = null;
            setActiveId(null);
            setDragBoard(null);
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {PRIORITY_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                items={board[status]}
                goals={goals.data ?? []}
                onDelete={(id) => deletePriority.mutate({ id })}
                onRename={(id, title) => updatePriority.mutate({ id, title })}
              />
            ))}
          </div>

          <DragOverlay>
            {activeItem ? <CardBody item={activeItem} goals={goals.data ?? []} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  status,
  items,
  goals,
  onDelete,
  onRename,
}: {
  status: PriorityStatusValue;
  items: PriorityItem[];
  goals: RouterOutputs["goals"]["list"];
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  // A coluna também é um alvo de drop — sem isso não dá para soltar em coluna vazia.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
        isOver ? "border-ring bg-accent/30" : ""
      }`}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{PRIORITY_STATUS_LABELS[status]}</h2>
        <span className="text-muted-foreground text-xs">{items.length}</span>
      </header>

      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-24 flex-col gap-2">
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              goals={goals}
              onDelete={() => onDelete(item.id)}
              onRename={(title) => onRename(item.id, title)}
            />
          ))}
          {items.length === 0 && (
            <li className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
              Arraste um card para cá.
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  item,
  goals,
  onDelete,
  onRename,
}: {
  item: PriorityItem;
  goals: RouterOutputs["goals"]["list"];
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
    >
      <CardBody
        item={item}
        goals={goals}
        onDelete={onDelete}
        onRename={onRename}
        handleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

function CardBody({
  item,
  goals,
  onDelete,
  onRename,
  handleProps,
  dragging,
}: {
  item: PriorityItem;
  goals: RouterOutputs["goals"]["list"];
  onDelete?: () => void;
  onRename?: (title: string) => void;
  handleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  const goal = goals.find((g) => g.id === item.goalId);

  return (
    <div
      className={`bg-background flex flex-col gap-2 rounded-lg border p-3 ${
        dragging ? "shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab text-sm leading-none"
          aria-label={`Mover ${item.title}`}
          {...handleProps}
        >
          ⠿
        </button>
        {editing ? (
          <input
            className={inputClass}
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <p
            className={`flex-1 text-sm ${item.status === "done" ? "line-through opacity-70" : ""}`}
          >
            {item.title}
          </p>
        )}
      </div>

      {(goal || item.dueDate || item.priorityLevel > 0) && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {goal && <span className="rounded-full border px-2 py-0.5">🎯 {goal.title}</span>}
          {item.dueDate && (
            <span className="rounded-full border px-2 py-0.5">📅 {item.dueDate}</span>
          )}
          {item.priorityLevel > 0 && (
            <span className="rounded-full border px-2 py-0.5">
              {LEVEL_LABELS[item.priorityLevel]}
            </span>
          )}
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border px-2 py-0.5 text-xs"
              style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {!dragging && (
        <div className="flex flex-wrap items-center gap-1">
          {editing ? (
            <>
              <Button
                size="sm"
                disabled={draft.trim().length === 0}
                onClick={() => {
                  onRename?.(draft.trim());
                  setEditing(false);
                }}
              >
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(item.title);
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTags((v) => !v)}>
                Tags
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                Excluir
              </Button>
            </>
          )}
        </div>
      )}

      {editingTags && !dragging && (
        <TagEditor
          priorityId={item.id}
          selected={item.tags}
          onClose={() => setEditingTags(false)}
        />
      )}
    </div>
  );
}

function NewPriorityForm({
  goals,
  pending,
  error,
  onCreate,
}: {
  goals: RouterOutputs["goals"]["list"];
  pending: boolean;
  error: string | null;
  onCreate: (input: {
    title: string;
    description: string | null;
    goalId: string | null;
    dueDate: string | null;
    priorityLevel: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [level, setLevel] = useState(0);

  const valid = title.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreate({
          title,
          description: null,
          goalId: goalId || null,
          dueDate: dueDate || null,
          priorityLevel: level,
        });
        setTitle("");
        setGoalId("");
        setDueDate("");
        setLevel(0);
      }}
    >
      <h2 className="text-lg font-medium">Nova prioridade</h2>
      <input
        className={inputClass}
        placeholder="O que precisa ser feito?"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <select
          className={`${inputClass} max-w-56`}
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          aria-label="Meta vinculada"
        >
          <option value="">Sem meta</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          className={`${inputClass} max-w-44`}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Prazo"
        />
        <select
          className={`${inputClass} max-w-40`}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          aria-label="Nível de prioridade"
        >
          {LEVEL_LABELS.map((label, value) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!valid || pending}>
          {pending ? "Criando…" : "Criar prioridade"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
