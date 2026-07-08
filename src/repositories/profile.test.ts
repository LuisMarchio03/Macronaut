import { describe, it, expect, beforeEach } from "vitest";
import type { Client } from "@libsql/client";
import { createTestDb } from "../../test/helpers/test-db";
import { getProfile, upsertProfile } from "./profile";

let db: Client;
beforeEach(async () => { db = await createTestDb(); });

const base = {
  sexo: "M" as const, data_nascimento: "1990-01-01", altura_cm: 180, peso_kg: 80,
  fator_atividade: 1.55, objetivo: "manutencao" as const,
  meta_kcal: 2500, meta_prot_g: 180, meta_carb_g: 250, meta_gord_g: 70,
};

describe("profile repo", () => {
  it("upsert cria e getProfile lê pelo mesmo userId", async () => {
    await upsertProfile(db, 1, base);
    const p = await getProfile(db, 1);
    expect(p?.peso_kg).toBe(80);
  });

  it("upsert duas vezes no mesmo userId atualiza (não duplica)", async () => {
    await upsertProfile(db, 1, base);
    await upsertProfile(db, 1, { ...base, peso_kg: 82 });
    const p = await getProfile(db, 1);
    expect(p?.peso_kg).toBe(82);
  });

  it("isola por usuário", async () => {
    await upsertProfile(db, 1, base);
    await upsertProfile(db, 2, { ...base, peso_kg: 60 });
    expect((await getProfile(db, 1))?.peso_kg).toBe(80);
    expect((await getProfile(db, 2))?.peso_kg).toBe(60);
    expect(await getProfile(db, 3)).toBeNull();
  });
});
