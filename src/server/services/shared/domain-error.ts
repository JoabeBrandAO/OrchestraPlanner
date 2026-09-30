/**
 * Erro de **domínio** (#76): a entrada não faz sentido ("o valor precisa ser maior que zero"),
 * não é o sistema que falhou. A borda do tRPC traduz para 400 — antes, todo `Error` virava
 * 500, e não havia como separar "alguém digitou zero" de "o banco caiu".
 *
 * Módulo puro: é importado também por regras que rodam no navegador.
 */
export class DomainError extends Error {
  readonly code: "BAD_REQUEST" | "NOT_FOUND" = "BAD_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** O registro pedido não existe — ou não é deste usuário, que para a RLS é a mesma coisa. */
export class NotFoundError extends DomainError {
  override readonly code = "NOT_FOUND" as const;

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
