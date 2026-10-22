import { describe, expect, it } from "vitest";
import { appManifest, MANIFEST_PATHS } from "@/features/notifications/manifest";
import {
  deviceLabel,
  isPushEndpoint,
  newOrderText,
  orderSummary,
  orderUrl,
  preorderText,
  receives,
  reminderText,
  type PushOrder,
  type SubscriptionAudience,
} from "@/features/notifications/messages";
import {
  isIOSDevice,
  pushSupport,
  vapidKeyBytes,
  type BrowserCapabilities,
} from "@/features/notifications/support";
import { isCronAuthorized } from "@/lib/cron-auth";
import { gtInstant } from "@/lib/gt-time";

const NOW = gtInstant("2026-10-22", 12 * 60);

const order: PushOrder = {
  id: "7b0f3c2e-1111-4222-8333-444455556666",
  businessId: "b0000000-0000-4000-8000-000000000001",
  branchId: "zona-10",
  branchName: "Zona 10",
  number: 42,
  totalCents: 13100,
  customerName: "María",
  orderType: "delivery",
  tableLabel: null,
  scheduledFor: null,
};

describe("textos de los avisos (guía §6 Paso 3)", () => {
  it("pedido nuevo: «Nuevo pedido #0042 · Q131.00» / «María · A domicilio · Zona 10»", () => {
    expect(newOrderText(order, NOW)).toEqual({
      title: "Nuevo pedido #0042 · Q131.00",
      body: "María · A domicilio · Zona 10",
      tag: `order-${order.id}`,
    });
  });

  it("comer aquí con mesa y programado para mañana", () => {
    const scheduled = {
      ...order,
      orderType: "dine_in" as const,
      tableLabel: "4",
      scheduledFor: gtInstant("2026-10-23", 7 * 60 + 30),
    };
    expect(orderSummary(scheduled, NOW)).toBe(
      "María · Comer aquí · Mesa 4 · Zona 10 · Para mañana 7:30",
    );
    expect(newOrderText(scheduled, NOW).title).toBe("Pedido programado #0042 · Q131.00");
  });

  it("escalamiento: «#0042 sigue esperando», con el mismo tag (reemplaza al anterior)", () => {
    const text = reminderText(order, NOW);
    expect(text.title).toBe("#0042 sigue esperando");
    expect(text.body).toContain("Q131.00");
    expect(text.tag).toBe(newOrderText(order, NOW).tag);
  });

  it("programado: aviso 30 min antes", () => {
    const at = gtInstant("2026-10-22", 12 * 60 + 30);
    expect(preorderText({ ...order, orderType: "takeout", scheduledFor: at }, NOW)).toMatchObject({
      title: "Programado #0042 en 30 min",
      body: "María · Para llevar · Zona 10 · Para hoy 12:30",
    });
  });

  it("al tocarlo abre el detalle: panel para dueño/encargado, /staff para el staff", () => {
    expect(orderUrl("user", order)).toBe(`/panel/${order.businessId}/pedidos/${order.id}`);
    expect(orderUrl("staff", order)).toBe(`/staff/pedidos/${order.id}`);
  });
});

describe("a quién le llega cada aviso", () => {
  const owner = { role: "owner" as const, allBranches: true, branchIds: [] };
  const managerA = { role: "manager" as const, allBranches: false, branchIds: ["antigua"] };
  const sub = (s: Partial<SubscriptionAudience>): SubscriptionAudience => ({
    branchId: null,
    member: null,
    staff: null,
    ...s,
  });

  it("el dueño con «Todas» recibe todas; con una sucursal, solo esa", () => {
    expect(receives(sub({ member: owner }), "zona-1")).toBe(true);
    expect(receives(sub({ member: owner, branchId: "antigua" }), "antigua")).toBe(true);
    expect(receives(sub({ member: owner, branchId: "antigua" }), "zona-1")).toBe(false);
  });

  it("el encargado solo de sus sucursales, aunque haya elegido «Todas mis sucursales»", () => {
    expect(receives(sub({ member: managerA }), "antigua")).toBe(true);
    expect(receives(sub({ member: managerA }), "zona-1")).toBe(false);
    expect(receives(sub({ member: managerA, branchId: "zona-1" }), "zona-1")).toBe(false);
  });

  it("quien ya no es del negocio no recibe nada", () => {
    expect(receives(sub({ member: null }), "zona-1")).toBe(false);
  });

  it("el staff, solo su sucursal y mientras esté activo", () => {
    const staff = { branchId: "zona-1", active: true };
    expect(receives(sub({ branchId: "zona-1", staff }), "zona-1")).toBe(true);
    expect(receives(sub({ branchId: "zona-1", staff }), "antigua")).toBe(false);
    expect(
      receives(sub({ branchId: "zona-1", staff: { ...staff, active: false } }), "zona-1"),
    ).toBe(false);
  });
});

describe("endpoints de push permitidos", () => {
  it("acepta los servicios de los navegadores", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
    ])
      expect(isPushEndpoint(url)).toBe(true);
  });

  it("rechaza cualquier otra URL (el servidor no hace POST a donde sea)", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/x",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://localhost/x",
      "https://169.254.169.254/latest",
      "no es url",
    ])
      expect(isPushEndpoint(url)).toBe(false);
  });
});

describe("etiqueta del dispositivo", () => {
  it.each([
    [
      "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
      "Chrome en Android",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      "iPhone",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0",
      "Edge en Windows",
    ],
    [null, "Dispositivo"],
  ])("%s → %s", (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });
});

describe("¿se pueden activar los avisos aquí?", () => {
  const base: BrowserCapabilities = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    isIOS: false,
    standalone: false,
    permission: "default",
    hasKey: true,
  };

  it("Chrome en Android: listo, sin instalar", () => {
    expect(pushSupport(base)).toBe("ready");
  });

  it("iPhone en Safari: primero «Agregar a inicio» (aunque Safari tenga las APIs)", () => {
    expect(pushSupport({ ...base, isIOS: true })).toBe("ios_install");
    expect(pushSupport({ ...base, isIOS: true, hasPushManager: false })).toBe("ios_install");
  });

  it("iPhone con la app instalada: listo en iOS 16.4+, actualizar si no hay push", () => {
    expect(pushSupport({ ...base, isIOS: true, standalone: true })).toBe("ready");
    expect(pushSupport({ ...base, isIOS: true, standalone: true, hasPushManager: false })).toBe(
      "ios_update",
    );
  });

  it("bloqueado, sin soporte (Instagram) o sin llave en el servidor", () => {
    expect(pushSupport({ ...base, permission: "denied" })).toBe("denied");
    expect(pushSupport({ ...base, hasPushManager: false })).toBe("unsupported");
    expect(pushSupport({ ...base, hasKey: false })).toBe("no_key");
  });

  it("detecta iPhone y el iPad que se presenta como Mac", () => {
    expect(isIOSDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)", "iPhone", 5)).toBe(
      true,
    );
    expect(isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(
      true,
    );
    expect(isIOSDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(
      false,
    );
  });

  it("convierte la llave pública base64url a bytes", () => {
    const bytes = vapidKeyBytes(
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    );
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe("apps instalables", () => {
  it("panel y staff con su inicio, alcance de todo el sitio e íconos 192/512/maskable", () => {
    const panel = appManifest("panel");
    const staff = appManifest("staff");
    expect(panel).toMatchObject({ start_url: "/panel", scope: "/", display: "standalone" });
    expect(staff).toMatchObject({ start_url: "/staff", scope: "/", short_name: "Pedidos" });
    expect(panel.id).not.toBe(staff.id);
    expect(panel.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(panel.icons?.some((i) => i.purpose === "maskable")).toBe(true);
    expect(MANIFEST_PATHS.panel).toMatch(/\.webmanifest$/);
  });
});

describe("protección del cron", () => {
  const secret = "s3cr3t-de-prueba-larguito";
  it("solo pasa con «Bearer <CRON_SECRET>»", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
  });
  it("sin CRON_SECRET (o muy corto) no pasa nadie", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer corto", "corto")).toBe(false);
  });
});
