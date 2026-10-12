// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ openUserProfile: vi.fn(), signOut: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => clerk }));

import { SessionActions } from "./session-actions";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionActions (tela de Conta)", () => {
  it("Sair encerra a sessão e volta para a página inicial", () => {
    render(<SessionActions />);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
  });

  it("Gerenciar login abre e-mail, senha e aparelhos do Clerk", () => {
    render(<SessionActions />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar login" }));
    expect(clerk.openUserProfile).toHaveBeenCalledTimes(1);
    expect(clerk.signOut).not.toHaveBeenCalled();
  });
});
