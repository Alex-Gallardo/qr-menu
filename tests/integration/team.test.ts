import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { visibleBranchIds } from "@/lib/auth/access";
import { getMembership } from "@/lib/auth/require-access";
import { inviteSchema, staffCreateSchema } from "@/features/team/schemas";
import {
  acceptInvitation,
  changeStaffPin,
  createStaff,
  getInvitation,
  inviteManager,
  listManagers,
  listStaff,
  removeMember,
  renewInvitation,
  revokeInvitation,
  setMemberBranches,
  setStaffActive,
} from "@/features/team/server";
import { PIN_TAKEN } from "@/features/team/team";
import { db } from "@/lib/db";
import { AppError, LimitExceededError } from "@/lib/errors";

/** QRM-040: equipo. Criterio: el encargado solo ve sus sucursales. */

const DAY = 24 * 60 * 60 * 1000;
const SLUG = "zz-test-qrm040-equipo";
const ownerId = randomUUID();
const managerId = randomUUID();
const mail = (n: string) => `zz-qrm040-${n}-${ownerId.slice(0, 8)}@qrmenu.test`;
let businessId: string;
let centro: string;
let norte: string;

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e as AppError,
  );
const invite = (email: string, branchIds: string[] = [], allBranches = false) =>
  inviteManager(inviteSchema.parse({ businessId, email, allBranches, branchIds }), {
    actorId: ownerId,
  });

beforeAll(async () => {
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().profiles.createMany({
    data: [
      { id: ownerId, full_name: "Dueña QRM-040" },
      { id: managerId, full_name: "Ana Encargada" },
    ],
  });
  const biz = await db().businesses.create({
    data: {
      slug: SLUG,
      name: "Prueba equipo",
      // Pro: 2 encargados y staff ilimitado.
      license: {
        create: { plan_id: "pro", status: "active", ends_at: new Date(Date.now() + 30 * DAY) },
      },
      members: { create: { user_id: ownerId, role: "owner" } },
      branches: {
        create: [
          { slug: "centro", name: "Centro", whatsapp_e164: "+50255550000" },
          { slug: "norte", name: "Norte", whatsapp_e164: "+50255550001" },
        ],
      },
    },
    select: { id: true, branches: { select: { id: true, slug: true } } },
  });
  businessId = biz.id;
  centro = biz.branches.find((b) => b.slug === "centro")!.id;
  norte = biz.branches.find((b) => b.slug === "norte")!.id;
});

afterAll(async () => {
  if (businessId) await db().audit_logs.deleteMany({ where: { business_id: businessId } });
  await db().businesses.deleteMany({ where: { slug: SLUG } });
  await db().profiles.deleteMany({ where: { id: { in: [ownerId, managerId] } } });
  await db().$disconnect();
});

describe("encargados", () => {
  let token: string;

  it("invitar: el link lleva el token; en la base solo su hash", async () => {
    ({ token } = await invite(mail("ana"), [norte]));
    const inv = await getInvitation(token);
    expect(inv).toMatchObject({
      email: mail("ana"),
      all_branches: false,
      branch_ids: [norte],
      state: "pending",
    });
    const row = await db().business_invitations.findFirstOrThrow({
      where: { business_id: businessId },
    });
    expect(row.token_hash).not.toBe(token);
    expect(row.token_hash).toHaveLength(64);
  });

  it("límite del plan contando las pendientes (Pro: 2); reinvitar al mismo correo no suma", async () => {
    await invite(mail("beto"), [centro]);
    // Reinvitar a Ana reemplaza su invitación (la vieja queda cancelada).
    const again = await invite(mail("ana"), [norte]);
    expect((await getInvitation(token))?.state).toBe("revoked");
    token = again.token;
    const third = await failure(invite(mail("carla"), [centro]));
    expect(third).toBeInstanceOf(LimitExceededError);
    // Cancelar libera el lugar.
    const beto = (await listManagers(businessId)).invitations.find(
      (i) => i.email === mail("beto"),
    )!;
    await revokeInvitation(businessId, beto.id, { actorId: ownerId });
    expect((await listManagers(businessId)).invitations.map((i) => i.email)).toEqual([mail("ana")]);
  });

  it("aceptar exige el correo invitado", async () => {
    const wrong = await failure(
      acceptInvitation(token, { id: managerId, email: "otra@correo.com" }),
    );
    expect(wrong?.code).toBe("wrong_email");
  });

  it("aceptar crea el encargado con sus sucursales: solo ve Norte (criterio)", async () => {
    const res = await acceptInvitation(token, { id: managerId, email: mail("ana").toUpperCase() });
    expect(res.businessId).toBe(businessId);
    expect((await getInvitation(token))?.state).toBe("accepted");
    // Aceptar otra vez no duplica.
    await acceptInvitation(token, { id: managerId, email: mail("ana") });
    expect(await db().business_members.count({ where: { business_id: businessId } })).toBe(2);

    const member = await getMembership(managerId, businessId);
    expect(member).toMatchObject({ role: "manager", allBranches: false, branchIds: [norte] });
    expect(visibleBranchIds(member!, [centro, norte])).toEqual([norte]);

    const { managers, invitations } = await listManagers(businessId);
    expect(invitations).toEqual([]);
    expect(managers).toMatchObject([
      { name: "Ana Encargada", allBranches: false, branchIds: [norte] },
    ]);
  });

  it("cambiar sus sucursales y luego quitarlo (pierde el acceso)", async () => {
    const memberId = (await listManagers(businessId)).managers[0]!.memberId;
    await setMemberBranches(
      {
        businessId,
        memberId,
        allBranches: false,
        branchIds: [centro, "00000000-0000-4000-8000-000000000000"],
      },
      { actorId: ownerId },
    );
    expect(
      (await db().member_branches.findMany({ where: { member_id: memberId } })).map(
        (b) => b.branch_id,
      ),
    ).toEqual([centro]);
    await setMemberBranches(
      { businessId, memberId, allBranches: true, branchIds: [] },
      { actorId: ownerId },
    );
    const all = await getMembership(managerId, businessId);
    expect(visibleBranchIds(all!, [centro, norte])).toEqual([centro, norte]);

    // Al dueño no se le toca desde aquí.
    const owner = await db().business_members.findFirstOrThrow({
      where: { business_id: businessId, role: "owner" },
    });
    expect((await failure(removeMember(businessId, owner.id, { actorId: ownerId })))?.code).toBe(
      "forbidden",
    );

    await removeMember(businessId, memberId, { actorId: ownerId });
    expect(
      await db().business_members.count({ where: { business_id: businessId, role: "manager" } }),
    ).toBe(0);
  });

  it("reenviar da un link nuevo; el viejo deja de servir", async () => {
    const { token: first } = await invite(mail("dora"), [], true);
    const inv = (await getInvitation(first))!;
    const { token: second } = await renewInvitation(businessId, inv.id, { actorId: ownerId });
    expect(second).not.toBe(first);
    expect(await getInvitation(first)).toBeNull();
    expect((await getInvitation(second))?.all_branches).toBe(true);
  });

  it("todo queda en la auditoría", async () => {
    const actions = (
      await db().audit_logs.findMany({
        where: { business_id: businessId },
        select: { action: true },
      })
    ).map((a) => a.action);
    for (const a of [
      "team.invite",
      "team.invite_revoke",
      "team.join",
      "team.branches",
      "team.remove",
      "team.invite_renew",
    ])
      expect(actions).toContain(a);
  });
});

describe("staff con PIN", () => {
  const create = (name: string, pin: string, branchId = centro) =>
    createStaff(staffCreateSchema.parse({ businessId, branchId, name, pin }), { actorId: ownerId });

  it("el PIN no se repite en la misma sucursal (sí en otra)", async () => {
    await create("Rosa - caja", "1234");
    const dup = await failure(create("Luis", "1234"));
    expect(dup?.userMessage).toBe(PIN_TAKEN);
    await create("Luis", "1234", norte);
    const staff = await listStaff([centro]);
    expect(staff.map((s) => s.name)).toEqual(["Rosa - caja"]);
    const saved = await db().staff_members.findFirstOrThrow({
      where: { business_id: businessId, branch_id: centro },
    });
    expect(saved.pin_hash).not.toContain("1234");
  });

  it("cambiar PIN quita el bloqueo; desactivar cierra sus turnos", async () => {
    const rosa = await db().staff_members.findFirstOrThrow({
      where: { business_id: businessId, branch_id: centro },
    });
    await db().staff_members.update({
      where: { id: rosa.id },
      data: { failed_attempts: 5, locked_until: new Date(Date.now() + 60_000) },
    });
    await changeStaffPin(businessId, rosa.id, "5678", { actorId: ownerId });
    const after = await db().staff_members.findUniqueOrThrow({ where: { id: rosa.id } });
    expect(after).toMatchObject({ failed_attempts: 0, locked_until: null });

    const device = await db().staff_devices.create({
      data: {
        business_id: businessId,
        branch_id: centro,
        name: "Tablet",
        token_hash: randomUUID(),
        approved_by: ownerId,
      },
    });
    await db().staff_sessions.create({
      data: {
        auth_user_id: randomUUID(),
        staff_member_id: rosa.id,
        device_id: device.id,
        business_id: businessId,
        branch_id: centro,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await setStaffActive(businessId, rosa.id, false, { actorId: ownerId });
    expect((await db().staff_members.findUniqueOrThrow({ where: { id: rosa.id } })).is_active).toBe(
      false,
    );
    expect(
      await db().staff_sessions.count({ where: { staff_member_id: rosa.id, ended_at: null } }),
    ).toBe(0);

    // Con Rosa inactiva, su PIN viejo queda libre en Centro.
    await create("Marta", "5678");
  });
});
