import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slugProblem } from "@/features/businesses/server";
import { db } from "@/lib/db";

/** Criterio de QRM-011: el link es único y no reservado (contra la base real). */

const TEMP_SLUG = "zz-test-qrm011";
let demoId: string;
let tempId: string;

beforeAll(async () => {
  const demo = await db().businesses.findUnique({
    where: { slug: "cafe-el-portal" },
    select: { id: true },
  });
  if (!demo) throw new Error("Falta el negocio demo: corre `pnpm db:seed` primero.");
  demoId = demo.id;
  await db().businesses.deleteMany({ where: { slug: TEMP_SLUG } });
  tempId = (await db().businesses.create({ data: { slug: TEMP_SLUG, name: "Prueba QRM-011" } })).id;
});

afterAll(async () => {
  await db().businesses.deleteMany({ where: { slug: TEMP_SLUG } });
  await db().$disconnect();
});

describe("link del negocio", () => {
  it("el negocio puede conservar su propio link", async () => {
    expect(await slugProblem("cafe-el-portal", demoId)).toBeNull();
  });

  it("no puede usar el link de otro negocio", async () => {
    expect(await slugProblem("cafe-el-portal", tempId)).toBe("taken");
  });

  it("no puede usar un link reservado", async () => {
    expect(await slugProblem("panel", tempId)).toBe("reserved");
    expect(await slugProblem("demo", tempId)).toBe("reserved");
  });

  it("un link libre y válido se puede usar", async () => {
    expect(await slugProblem("zz-test-qrm011-libre", tempId)).toBeNull();
  });

  it("la base también lo impide (índice único) si dos guardan a la vez", async () => {
    await expect(
      db().businesses.update({ where: { id: tempId }, data: { slug: "cafe-el-portal" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
