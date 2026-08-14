-- Único de `(user_id, lower(name))` em `life_areas` — corrige a duplicação do seed
-- (docs/ERROS.md 2026-08-13). O `CREATE UNIQUE INDEX` está no fim; antes dele, a
-- limpeza defensiva das duplicatas que já existirem no banco, porque criar o índice
-- sobre dados duplicados falharia e travaria a migration.
--
-- A limpeza **preserva o que aponta para a área**: metas e avaliações são remapeadas
-- para a área sobrevivente (a mais antiga de cada nome) antes que as cópias sumam.
-- Sem isso, o `ON DELETE SET NULL` de `goals.life_area_id` desligaria metas da sua área
-- silenciosamente — apagar duplicata não pode custar dado do usuário.

-- Sobreviventes: a linha mais antiga de cada (user_id, lower(name)).
CREATE TEMP TABLE life_area_dupes AS
SELECT
  dup.id AS dupe_id,
  keep.id AS keep_id
FROM "life_areas" dup
JOIN LATERAL (
  SELECT inner_area.id
  FROM "life_areas" inner_area
  WHERE inner_area."user_id" = dup."user_id"
    AND lower(inner_area."name") = lower(dup."name")
  ORDER BY inner_area."created_at", inner_area."id"
  LIMIT 1
) keep ON true
WHERE dup.id <> keep.id;
--> statement-breakpoint

-- Metas das cópias passam para a sobrevivente.
UPDATE "goals" g
SET "life_area_id" = d.keep_id
FROM life_area_dupes d
WHERE g."life_area_id" = d.dupe_id;
--> statement-breakpoint

-- Avaliações: se a sobrevivente já tem nota naquela rodada, a da cópia é redundante e
-- sai; as demais são remapeadas. (O único `(user_id, assessed_at, life_area_id)` não
-- admitiria as duas.)
DELETE FROM "life_assessments" a
USING life_area_dupes d
WHERE a."life_area_id" = d.dupe_id
  AND EXISTS (
    SELECT 1 FROM "life_assessments" survivor
    WHERE survivor."life_area_id" = d.keep_id
      AND survivor."user_id" = a."user_id"
      AND survivor."assessed_at" = a."assessed_at"
  );
--> statement-breakpoint

UPDATE "life_assessments" a
SET "life_area_id" = d.keep_id
FROM life_area_dupes d
WHERE a."life_area_id" = d.dupe_id;
--> statement-breakpoint

DELETE FROM "life_areas" a USING life_area_dupes d WHERE a.id = d.dupe_id;
--> statement-breakpoint

DROP TABLE life_area_dupes;
--> statement-breakpoint

CREATE UNIQUE INDEX "life_areas_user_lower_name_uq" ON "life_areas" USING btree ("user_id",lower("name"));
