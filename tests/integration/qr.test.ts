import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQrSchema } from "@/features/qr/schemas";
import {
  createQrCodes,
  deleteQrCode,
  listQrCodes,
  resolveScan,
  restoreQrCode,
} from "@/features/qr/server";
import { db } from "@/lib/db";
import { AppError, LimitExceededError } from "@/lib/errors";

/** QRM-035: QR por sucursal y mesa, /q/{code} y conteo de escaneos. */

const DAY = 24 * 60 * 60 * 1000;
const FREE = "zz-test-qrm035-gratis";
const PRO = "zz-test-qrm035-pro";
const ids: { business: string; branch: string }[] = [];
let actorId: string;

async function tempBusiness(slug: string, plan_id: string) {
  const biz = await db().businesses.create({
    data: {
      slug,
      name: `Prueba ${plan_id}`,
      license: { create: { plan_id, status: "active", ends_at: new Date(Date.now() + 30 * DAY) } },
      branches: { create: { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" } },
    },
    select: { id: true, branches: { select: { id: true } } },
  });
  const entry = { business: biz.id, branch: biz.branches[0]!.id };
  ids.push(entry);
  return entry;
}

const input = (raw: Record<string, unknown>) => createQrSchema.parse(raw);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

let free: { business: string; branch: string };
let pro: { business: string; branch: string };

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: { in: [FREE, PRO] } } });
  free = await tempBusiness(FREE, "gratis");
  pro = await tempBusiness(PRO, "pro");
  const owner = await db().business_members.findFirst({ where: { role: "owner" } });
  if (!owner) throw new Error("Falta el seed: corre `pnpm db:seed` primero.");
  actorId = owner.user_id;
});

afterAll(async () => {
  const businessIds = ids.map((i) => i.business);
  await db().analytics_events.deleteMany({ where: { business_id: { in: businessIds } } });
  await db().audit_logs.deleteMany({ where: { business_id: { in: businessIds } } });
  await db().businesses.deleteMany({ where: { slug: { in: [FREE, PRO] } } });
  await db().$disconnect();
});

describe("QR", () => {
  it("plan Gratis: un QR; el segundo choca con el límite", async () => {
    await createQrCodes(
      input({ businessId: free.business, branchId: free.branch, kind: "branch" }),
      { actorId },
    );
    const error = await failure(
      createQrCodes(
        input({
          businessId: free.business,
          branchId: free.branch,
          kind: "campaign",
          label: "Volante",
        }),
        { actorId },
      ),
    );
    expect(error).toBeInstanceOf(LimitExceededError);
  });

  it("la sucursal tiene un solo QR general", async () => {
    await createQrCodes(input({ businessId: pro.business, branchId: pro.branch, kind: "branch" }), {
      actorId,
    });
    const error = await failure(
      createQrCodes(input({ businessId: pro.business, branchId: pro.branch, kind: "branch" }), {
        actorId,
      }),
    );
    expect((error as AppError).code).toBe("qr_exists");
  });

  it("mesas por rango, sin repetir las que ya existen, en orden numérico", async () => {
    const first = await createQrCodes(
      input({ businessId: pro.business, branchId: pro.branch, kind: "table", from: 8, to: 12 }),
      { actorId },
    );
    expect(first).toEqual({ created: 5, skipped: 0 });
    const second = await createQrCodes(
      input({ businessId: pro.business, branchId: pro.branch, kind: "table", from: 1, to: 9 }),
      { actorId },
    );
    expect(second).toEqual({ created: 7, skipped: 2 });
    const list = await listQrCodes(pro.business, [pro.branch]);
    expect(list[0]!.kind).toBe("branch");
    expect(list.filter((q) => q.kind === "table").map((q) => q.table)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]);
    expect(new Set(list.map((q) => q.code)).size).toBe(list.length);
  });

  it("no acepta la sucursal de otro negocio", async () => {
    const error = await failure(
      createQrCodes(input({ businessId: pro.business, branchId: free.branch, kind: "branch" }), {
        actorId,
      }),
    );
    expect((error as AppError).code).toBe("branch_forbidden");
  });

  it("escanear lleva a la sucursal con la mesa y se cuenta; los bots no", async () => {
    const mesa4 = (await listQrCodes(pro.business, [pro.branch])).find((q) => q.table === "4")!;
    expect(await resolveScan(mesa4.code, { count: true })).toBe(`/${PRO}/centro?mesa=4`);
    expect(await resolveScan(mesa4.code, { count: true })).toBe(`/${PRO}/centro?mesa=4`);
    expect(await resolveScan(mesa4.code, { count: false })).toBe(`/${PRO}/centro?mesa=4`);
    const after = (await listQrCodes(pro.business, [pro.branch])).find((q) => q.id === mesa4.id)!;
    expect(after.scans).toBe(2);
    expect(
      await db().analytics_events.count({ where: { qr_code_id: mesa4.id, event: "qr_scan" } }),
    ).toBe(2);
  });

  it("los QR viejos (código como demo01, sin style) siguen funcionando y cuentan como el de la sucursal", async () => {
    const legacy = await db().qr_codes.create({
      data: {
        business_id: free.business,
        branch_id: free.branch,
        label: "General",
        short_code: "zz035legacy",
      },
    });
    expect(await resolveScan("zz035legacy", { count: false })).toBe(`/${FREE}/centro`);
    await db().qr_codes.delete({ where: { id: legacy.id } });
  });

  it("códigos desconocidos o mal formados no llevan a ningún lado", async () => {
    expect(await resolveScan("ZZZZZZZ", { count: true })).toBeNull();
    expect(await resolveScan("../../x", { count: true })).toBeNull();
  });

  it("borrar y deshacer conserva el código impreso y sus escaneos", async () => {
    const before = (await listQrCodes(pro.business, [pro.branch])).find((q) => q.table === "4")!;
    const restore = await deleteQrCode(pro.business, before.id, { actorId });
    expect(await resolveScan(before.code, { count: true })).toBeNull();
    await restoreQrCode(pro.business, restore);
    const back = (await listQrCodes(pro.business, [pro.branch])).find((q) => q.table === "4")!;
    expect(back.code).toBe(before.code);
    expect(back.scans).toBe(2);
  });
});
