import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_ZONE,
  dateIn,
  instantAt,
  isValidTimeZone,
  resolveTimeZone,
} from "./time-zone";

/** Fuso do usuário (#72) — regra pura, sem banco. */

describe("dateIn", () => {
  it("às 23h UTC, quem está em São Paulo ainda está no mesmo dia", () => {
    const now = new Date("2026-09-30T23:00:00Z");
    expect(dateIn(now, "America/Sao_Paulo")).toBe("2026-09-30");
    expect(dateIn(now, "UTC")).toBe("2026-09-30");
  });

  it("às 2h UTC, São Paulo ainda está no dia anterior", () => {
    const now = new Date("2026-10-01T02:00:00Z");
    expect(dateIn(now, "America/Sao_Paulo")).toBe("2026-09-30");
    expect(dateIn(now, "UTC")).toBe("2026-10-01");
  });

  it("do outro lado do mundo, o dia já virou", () => {
    expect(dateIn(new Date("2026-09-30T15:00:00Z"), "Asia/Tokyo")).toBe("2026-10-01");
  });

  it("formata como o `date` do Postgres, com zero à esquerda", () => {
    expect(dateIn(new Date("2026-01-05T12:00:00Z"), "America/Sao_Paulo")).toBe("2026-01-05");
  });
});

describe("instantAt", () => {
  it("8h em São Paulo é 11h UTC", () => {
    expect(instantAt({ year: 2026, month: 9, day: 30 }, 8, "America/Sao_Paulo").toISOString()).toBe(
      "2026-09-30T11:00:00.000Z",
    );
  });

  it("respeita horário de verão onde ele existe", () => {
    // Nova York: EDT (UTC-4) em julho, EST (UTC-5) em janeiro.
    expect(instantAt({ year: 2026, month: 7, day: 1 }, 8, "America/New_York").toISOString()).toBe(
      "2026-07-01T12:00:00.000Z",
    );
    expect(instantAt({ year: 2026, month: 1, day: 15 }, 8, "America/New_York").toISOString()).toBe(
      "2026-01-15T13:00:00.000Z",
    );
  });

  it("fuso adiante de UTC volta para o dia anterior em UTC", () => {
    expect(instantAt({ year: 2026, month: 10, day: 1 }, 8, "Asia/Tokyo").toISOString()).toBe(
      "2026-09-30T23:00:00.000Z",
    );
  });
});

describe("isValidTimeZone / resolveTimeZone", () => {
  it("aceita nome IANA e recusa o resto", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Brasil/Gama")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("fuso nunca definido ou inválido cai no padrão, em vez de derrubar a tela", () => {
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("lixo")).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("Europe/Lisbon")).toBe("Europe/Lisbon");
  });
});
