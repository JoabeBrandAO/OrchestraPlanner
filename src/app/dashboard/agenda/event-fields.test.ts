import { describe, expect, it } from "vitest";

import {
  checkEventFields,
  parseEventFields,
  suggestEnd,
  toLocalInput,
  type RawEventFields,
} from "./event-fields";

/**
 * Regras do formulário de compromisso (#34) — puras, sem React e sem DOM. É o que roda a
 * cada tecla: se isto for barato e não mexer em estado, digitar não custa render.
 */

const raw = (patch: Partial<RawEventFields> = {}): RawEventFields => ({
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  frequency: "none",
  lifeAreaId: "",
  priorityId: "",
  reminder: "",
  ...patch,
});

const preenchido = raw({
  title: "Corrida",
  startsAt: "2026-08-17T07:00",
  endsAt: "2026-08-17T08:00",
});

describe("checkEventFields", () => {
  it("só libera o salvar com título e janela válida", () => {
    expect(checkEventFields(preenchido).canSubmit).toBe(true);
    expect(checkEventFields(raw()).canSubmit).toBe(false);
    expect(checkEventFields({ ...preenchido, title: "   " }).canSubmit).toBe(false);
    expect(checkEventFields({ ...preenchido, endsAt: "" }).canSubmit).toBe(false);
  });

  it("acusa a janela invertida só quando os dois campos estão preenchidos", () => {
    // Enquanto se digita o início, o fim ainda vazio não é erro — seria acusar cedo demais.
    expect(checkEventFields(raw({ startsAt: "2026-08-17T08:00" })).invertedWindow).toBe(false);

    const invertido = { ...preenchido, startsAt: "2026-08-17T09:00" };
    expect(checkEventFields(invertido).invertedWindow).toBe(true);
    expect(checkEventFields(invertido).canSubmit).toBe(false);
  });

  it("recusa fim igual ao início — compromisso de duração zero não existe", () => {
    const iguais = { ...preenchido, endsAt: preenchido.startsAt };
    expect(checkEventFields(iguais).invertedWindow).toBe(true);
  });

  it("devolve o mesmo veredito para a mesma entrada (o container compara para não re-renderizar)", () => {
    const primeiro = checkEventFields(preenchido);
    const segundo = checkEventFields(preenchido);
    expect(primeiro).toEqual(segundo);
  });
});

describe("parseEventFields", () => {
  it("converte para os tipos do domínio", () => {
    const values = parseEventFields({
      ...preenchido,
      description: "corrida leve",
      frequency: "weekly",
      lifeAreaId: "area-1",
      priorityId: "prio-1",
      reminder: "15",
    });

    expect(values).not.toBeNull();
    expect(values!.title).toBe("Corrida");
    expect(values!.description).toBe("corrida leve");
    expect(values!.frequency).toBe("weekly");
    expect(values!.lifeAreaId).toBe("area-1");
    expect(values!.priorityId).toBe("prio-1");
    expect(values!.reminderMinutesBefore).toBe(15);
    expect(values!.startsAt.getHours()).toBe(7);
    expect(values!.endsAt.getHours()).toBe(8);
  });

  it("vazio vira `null`, não string vazia — é o que o serviço espera", () => {
    const values = parseEventFields(preenchido);
    expect(values!.description).toBeNull();
    expect(values!.lifeAreaId).toBeNull();
    expect(values!.priorityId).toBeNull();
    expect(values!.reminderMinutesBefore).toBeNull();
  });

  it("lembrete 0 é um lembrete (na hora), não a ausência dele", () => {
    expect(parseEventFields({ ...preenchido, reminder: "0" })!.reminderMinutesBefore).toBe(0);
  });

  it("apara o título, mas preserva o texto da descrição", () => {
    const values = parseEventFields({ ...preenchido, title: "  Corrida  ", description: " leve " });
    expect(values!.title).toBe("Corrida");
    expect(values!.description).toBe(" leve ");
  });

  it("devolve `null` quando os campos não passam na checagem", () => {
    expect(parseEventFields(raw())).toBeNull();
    expect(parseEventFields({ ...preenchido, startsAt: "2026-08-17T09:00" })).toBeNull();
  });

  it("frequência desconhecida cai para 'none' em vez de vazar para o servidor", () => {
    expect(parseEventFields({ ...preenchido, frequency: "sextas-de-lua-cheia" })!.frequency).toBe(
      "none",
    );
  });
});

describe("suggestEnd", () => {
  it("sugere uma hora depois do início", () => {
    expect(suggestEnd("2026-08-17T07:00")).toBe("2026-08-17T08:00");
  });

  it("atravessa a meia-noite virando o dia", () => {
    expect(suggestEnd("2026-08-17T23:30")).toBe("2026-08-18T00:30");
  });

  it("devolve vazio quando não há início — não há o que sugerir", () => {
    expect(suggestEnd("")).toBe("");
    expect(suggestEnd("qualquer coisa")).toBe("");
  });
});

describe("toLocalInput", () => {
  it("formata no padrão do `datetime-local`, com zero à esquerda", () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });
});
