// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { describeImport, ImportForm, type ImportSummary } from "./import-form";

/** Importar extrato (#55) — o resultado precisa ser dito, inclusive quando dá errado. */

afterEach(cleanup);

const vazio: ImportSummary = { imported: 0, duplicated: 0, categorized: 0, problems: [] };

describe("describeImport", () => {
  it("conta no singular quando é um só", () => {
    expect(describeImport({ ...vazio, imported: 1 })).toBe("1 lançamento importado.");
  });

  it("junta importados, repetidos, categorizados e problemas", () => {
    expect(
      describeImport({
        imported: 12,
        duplicated: 3,
        categorized: 9,
        problems: [{ line: 4, reason: "Data não reconhecida.", raw: "..." }],
      }),
    ).toBe(
      "12 lançamentos importados · 3 já existiam (não dupliquei) · 9 ganharam categoria pelo histórico · 1 linha que não entendi.",
    );
  });

  it("diz zero em vez de ficar em silêncio", () => {
    // É a hora em que a pessoa mais precisa de resposta: reimportou o mesmo arquivo.
    expect(describeImport({ ...vazio, duplicated: 5 })).toBe(
      "0 lançamentos importados · 5 já existiam (não dupliquei).",
    );
  });
});

describe("ImportForm", () => {
  const accounts = [{ id: "acc-1", name: "Conta corrente" }];

  function renderForm(result: ImportSummary | null = null) {
    render(
      <ImportForm
        accounts={accounts}
        pending={false}
        result={result}
        onSubmit={() => {}}
        onClose={() => {}}
      />,
    );
  }

  it("não deixa importar sem escolher arquivo", () => {
    renderForm();

    expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("mostra as linhas que ficaram de fora, com número e texto cru", () => {
    renderForm({
      imported: 2,
      duplicated: 0,
      categorized: 0,
      problems: [{ line: 7, reason: "Data não reconhecida.", raw: "linha estragada" }],
    });

    expect(screen.getByText(/Linha 7: Data não reconhecida\./)).toBeTruthy();
    expect(screen.getByText("linha estragada")).toBeTruthy();
  });
});
