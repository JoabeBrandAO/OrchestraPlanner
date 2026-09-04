"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { trpc } from "@/trpc/react";

import { CategoryForm } from "./category-form";
import { type CategoryOption } from "./transaction-form";

type Alvo = { kind: "nova" } | { kind: "renomear"; category: CategoryOption };

/**
 * Categorias (#63) — criar, renomear e remover as etiquetas do dinheiro.
 *
 * As 10 semeadas na primeira conta são um palpite para começar, não a lista definitiva:
 * sem esta tela, quem organiza a vida por categorias próprias ficava com tudo caindo em
 * "Sem categoria" no relatório.
 *
 * O nome não está copiado em lugar nenhum — extrato, orçamento e relatório leem por `join`
 * —, então renomear aqui muda as três telas de uma vez.
 */
export function CategoriesPanel() {
  const utils = trpc.useUtils();
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const categories = trpc.finance.categories.useQuery();

  /** Os rótulos do extrato, do orçamento e do relatório saem daqui por `join`. */
  const invalidate = () => {
    utils.finance.transactions.invalidate();
    utils.finance.budget.invalidate();
    utils.finance.report.invalidate();
    return utils.finance.categories.invalidate();
  };

  const fechar = () => {
    setAlvo(null);
    return invalidate();
  };

  const createCategory = trpc.finance.createCategory.useMutation({
    onSuccess: (row) => {
      // O serviço devolve a que já existe em vez de estourar (índice único + `on conflict`).
      // Quem está na tela precisa saber que não nasceu nada novo, senão parece que o botão
      // não funcionou.
      const jaExistia = (categories.data ?? []).some((category) => category.id === row.id);
      setAviso(jaExistia ? `"${row.name}" já existia — nada foi criado.` : null);
      return fechar();
    },
  });

  const renameCategory = trpc.finance.renameCategory.useMutation({ onSuccess: fechar });
  const deleteCategory = trpc.finance.deleteCategory.useMutation({ onSuccess: invalidate });

  const lista = categories.data ?? [];
  const porSentido = [
    { direction: "entrada" as const, titulo: "Entradas" },
    { direction: "saida" as const, titulo: "Saídas" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Categorias</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAviso(null);
            setAlvo({ kind: "nova" });
          }}
        >
          + Nova categoria
        </Button>
      </div>

      {aviso && <p className="text-muted-foreground text-sm">{aviso}</p>}

      {categories.isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando categorias…</p>
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Nenhuma categoria ainda. Crie uma conta para ganhar as 10 padrão — ou faça as suas.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {porSentido.map((grupo) => {
            const doGrupo = lista.filter((category) => category.direction === grupo.direction);
            if (doGrupo.length === 0) return null;

            return (
              <div key={grupo.direction} className="flex flex-col gap-2">
                <h3 className="text-muted-foreground text-xs font-medium">{grupo.titulo}</h3>
                <ul className="flex flex-col gap-2">
                  {doGrupo.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2"
                    >
                      <span className="text-sm">{category.name}</span>
                      <span className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Renomear categoria ${category.name}`}
                          onClick={() => {
                            setAviso(null);
                            setAlvo({ kind: "renomear", category });
                          }}
                        >
                          Renomear
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleteCategory.isPending}
                          aria-label={`Remover categoria ${category.name}`}
                          onClick={() => deleteCategory.mutate({ id: category.id })}
                        >
                          Remover
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Remover uma categoria não apaga lançamento: o que estava nela passa a contar como &ldquo;Sem
        categoria&rdquo;. O orçamento dela, esse vai junto.
      </p>

      <FormDialog
        open={alvo !== null}
        onOpenChange={(open) => !open && setAlvo(null)}
        title={alvo?.kind === "renomear" ? "Renomear categoria" : "Nova categoria"}
      >
        {alvo && (
          <CategoryForm
            // Remontar ao trocar de alvo é o que faz o preenchimento acompanhar a categoria.
            key={alvo.kind === "renomear" ? alvo.category.id : "nova"}
            initial={
              alvo.kind === "renomear"
                ? { name: alvo.category.name, direction: alvo.category.direction }
                : undefined
            }
            pending={createCategory.isPending || renameCategory.isPending}
            error={createCategory.error?.message ?? renameCategory.error?.message}
            onCancel={() => setAlvo(null)}
            onSubmit={(values) =>
              alvo.kind === "renomear"
                ? renameCategory.mutate({ id: alvo.category.id, name: values.name })
                : createCategory.mutate(values)
            }
          />
        )}
      </FormDialog>
    </section>
  );
}
