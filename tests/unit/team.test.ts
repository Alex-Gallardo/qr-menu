import { describe, expect, it } from "vitest";
import { buildInviteEmail } from "@/features/team/email";
import { inviteSchema, staffCreateSchema, staffPinSchema } from "@/features/team/schemas";
import {
  branchesLabel,
  INVITE_TTL_DAYS,
  inviteExpiry,
  inviteShareText,
  inviteState,
  invitePath,
} from "@/features/team/team";

/** QRM-040: equipo (encargados por sucursal, staff con PIN). */

const ID = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";
const OTHER = "7a2c3d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d";
const branches = [
  { id: ID, name: "Zona 1" },
  { id: OTHER, name: "Antigua" },
  { id: "x", name: "Xela" },
];

describe("invitaciones", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  it("vence a los 7 días", () => {
    expect(inviteExpiry(now).getTime() - now.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
  });
  it("estado: aceptada > cancelada > vencida > pendiente", () => {
    const base = { expires_at: inviteExpiry(now), accepted_at: null, revoked_at: null };
    expect(inviteState(base, now)).toBe("pending");
    expect(inviteState({ ...base, expires_at: now }, now)).toBe("expired");
    expect(inviteState({ ...base, revoked_at: now }, now)).toBe("revoked");
    expect(inviteState({ ...base, revoked_at: now, accepted_at: now }, now)).toBe("accepted");
  });
  it("el link y el texto para WhatsApp", () => {
    expect(invitePath("abc")).toBe("/invitacion/abc");
    expect(inviteShareText("Café El Portal", "https://x.app/invitacion/abc")).toContain(
      "Café El Portal",
    );
  });
});

describe("sucursales", () => {
  it("todas, una o varias", () => {
    expect(branchesLabel(true, [], branches)).toBe("Todas las sucursales");
    expect(branchesLabel(false, [OTHER], branches)).toBe("Antigua");
    expect(branchesLabel(false, [ID, OTHER, "x"], branches)).toBe("Zona 1, Antigua y Xela");
    expect(branchesLabel(false, ["borrada"], branches)).toBe("Sin sucursales");
  });
});

describe("validación", () => {
  it("invitar: correo en minúsculas y al menos una sucursal (o todas)", () => {
    const ok = inviteSchema.parse({
      businessId: ID,
      email: " Ana@Correo.COM ",
      allBranches: false,
      branchIds: [OTHER],
    });
    expect(ok.email).toBe("ana@correo.com");
    expect(
      inviteSchema.safeParse({
        businessId: ID,
        email: "ana@correo.com",
        allBranches: false,
        branchIds: [],
      }).success,
    ).toBe(false);
    expect(
      inviteSchema.safeParse({
        businessId: ID,
        email: "ana@correo.com",
        allBranches: true,
        branchIds: [],
      }).success,
    ).toBe(true);
    expect(
      inviteSchema.safeParse({
        businessId: ID,
        email: "no-es-correo",
        allBranches: true,
        branchIds: [],
      }).success,
    ).toBe(false);
  });
  it("staff: PIN de 4 a 6 números", () => {
    const base = { businessId: ID, branchId: OTHER, name: "Rosa - caja" };
    expect(staffCreateSchema.safeParse({ ...base, pin: "1234" }).success).toBe(true);
    expect(staffCreateSchema.safeParse({ ...base, pin: "123" }).success).toBe(false);
    expect(staffCreateSchema.safeParse({ ...base, pin: "1234567" }).success).toBe(false);
    expect(staffPinSchema.safeParse({ businessId: ID, staffId: OTHER, pin: "12a4" }).success).toBe(
      false,
    );
  });
});

describe("correo de invitación", () => {
  it("escapa el HTML y lleva el link", () => {
    const mail = buildInviteEmail({
      businessName: "Café <Portal>",
      inviterName: "Alex",
      branches: "Zona 1",
      link: "https://x.app/invitacion/abc",
      brandName: "QR Menu",
      days: 7,
    });
    expect(mail.subject).toBe("Alex te invita al equipo de Café <Portal>");
    expect(mail.html).toContain("Café &lt;Portal&gt;");
    expect(mail.html).not.toContain("<Portal>");
    expect(mail.html).toContain('href="https://x.app/invitacion/abc"');
    expect(mail.text).toContain("https://x.app/invitacion/abc");
  });
});
