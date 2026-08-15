import { describe, expect, it } from "vitest";

import {
  canonicalLink,
  inverseOf,
  linkFrom,
  RELATION_LABELS,
  RELATIONS,
  type RelationValue,
} from "./relations";

/**
 * Vínculos entre pessoas (#42) — a parte pura. O vínculo é gravado uma vez só e lido dos
 * dois lados, então o inverso precisa ser exato.
 */

describe("inverseOf", () => {
  it("toda relação tem inverso, e o inverso do inverso é ela mesma", () => {
    for (const relation of RELATIONS) {
      expect(RELATIONS).toContain(inverseOf(relation));
      expect(inverseOf(inverseOf(relation))).toBe(relation);
    }
  });

  it("as assimétricas viram a contraparte", () => {
    expect(inverseOf("pai_mae")).toBe("filho");
    expect(inverseOf("avo")).toBe("neto");
    expect(inverseOf("tio")).toBe("sobrinho");
    expect(inverseOf("sogro")).toBe("genro_nora");
    expect(inverseOf("mentor")).toBe("mentorado");
  });

  it("as simétricas são o próprio inverso — é assim no mundo, não é atalho", () => {
    for (const relation of ["conjuge", "irmao", "primo", "cunhado", "amigo", "colega"] as const) {
      expect(inverseOf(relation)).toBe(relation);
    }
  });

  it("toda relação tem rótulo em português", () => {
    for (const relation of RELATIONS) {
      expect(RELATION_LABELS[relation as RelationValue]).toBeTruthy();
    }
  });
});

describe("canonicalLink", () => {
  it("mantém a ordem quando o par já está ordenado", () => {
    expect(canonicalLink("aaa", "bbb", "pai_mae")).toEqual({
      personId: "aaa",
      relatedPersonId: "bbb",
      relation: "pai_mae",
    });
  });

  it("ao inverter o par, inverte também a relação", () => {
    // "B é pai de A" gravado como "A é filho de B" — mesma verdade, uma linha só.
    expect(canonicalLink("bbb", "aaa", "pai_mae")).toEqual({
      personId: "aaa",
      relatedPersonId: "bbb",
      relation: "filho",
    });
  });

  it("os dois sentidos produzem exatamente a mesma linha", () => {
    // É isto que faz o índice único impedir o espelho.
    const ida = canonicalLink("aaa", "bbb", "mentor");
    const volta = canonicalLink("bbb", "aaa", "mentorado");
    expect(ida).toEqual(volta);
  });
});

describe("linkFrom", () => {
  const link = canonicalLink("aaa", "bbb", "pai_mae"); // bbb é pai/mãe de aaa

  it("do lado de quem guardou, a relação é a gravada", () => {
    expect(linkFrom(link, "aaa")).toEqual({ otherId: "bbb", relation: "pai_mae" });
  });

  it("do outro lado, é o inverso — sem uma segunda linha para divergir", () => {
    expect(linkFrom(link, "bbb")).toEqual({ otherId: "aaa", relation: "filho" });
  });

  it("relação simétrica aparece igual dos dois lados", () => {
    const irmaos = canonicalLink("aaa", "bbb", "irmao");
    expect(linkFrom(irmaos, "aaa").relation).toBe("irmao");
    expect(linkFrom(irmaos, "bbb").relation).toBe("irmao");
  });
});
