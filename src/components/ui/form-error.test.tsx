// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FormError } from "./form-error";

afterEach(cleanup);

describe("FormError", () => {
  it("anuncia a mensagem ao leitor de tela", () => {
    render(<FormError message="Título é obrigatório." />);
    expect(screen.getByRole("alert").textContent).toBe("Título é obrigatório.");
  });

  it("sem mensagem não desenha nada", () => {
    const { container } = render(<FormError message={null} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
