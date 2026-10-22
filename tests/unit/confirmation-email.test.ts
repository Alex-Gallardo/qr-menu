import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConfirmationEmail,
  type ConfirmationEmailData,
} from "@/features/orders/email-template";
import type { MessageOrder } from "@/features/orders/whatsapp";
import { addDays, gtInstant } from "@/lib/gt-time";
import { emailEnabled, sendEmail, senderAddress } from "@/lib/email";

const TODAY = "2026-10-21";
const NOW = gtInstant(TODAY, 21 * 60 + 30);

const order = (over: Partial<MessageOrder> = {}): MessageOrder => ({
  number: 42,
  businessName: "Café El Portal",
  branchName: "Zona 10",
  customerName: "María López",
  customerPhone: "+50255551234",
  orderType: "delivery",
  tableLabel: null,
  scheduledFor: null,
  items: [
    {
      name: "Desayuno chapín",
      quantity: 2,
      lineCents: 9000,
      options: [{ group: "Extras", name: "Extra plátanos", deltaCents: 800 }],
      note: "sin cebolla",
    },
  ],
  subtotalCents: 9000,
  deliveryFeeCents: 1500,
  totalCents: 10500,
  payment: "transfer",
  bankName: "Banco Industrial",
  address: "4a avenida 12-30, zona 10",
  addressReference: "portón negro",
  location: null,
  note: null,
  detailUrl: "https://qr-menu.app/cafe-el-portal/zona-10/pedido/7f3a",
  greeting: null,
  farewell: null,
  ...over,
});

const data = (over: Partial<ConfirmationEmailData> = {}): ConfirmationEmailData => ({
  order: order(),
  statusUrl: "https://qr-menu.app/cafe-el-portal/zona-10/pedido/7f3a",
  branchWhatsapp: "+50255550000",
  bankAccounts: [
    {
      bankName: "Banco Industrial",
      accountType: "Monetaria",
      accountNumber: "123-456789-0",
      holderName: "Café El Portal, S.A.",
      instructions: "Envía tu boleta por WhatsApp.",
    },
  ],
  logoUrl: null,
  primaryColor: "#D23B22",
  onPrimaryColor: "#FFFFFF",
  brandName: "QR Menu",
  ...over,
});

describe("correo de confirmación", () => {
  it("asunto de la guía", () => {
    expect(buildConfirmationEmail(data(), NOW).subject).toBe(
      "Recibimos tu pedido #0042 en Café El Portal · Zona 10",
    );
  });

  it("resumen, dirección, total, pago, cuentas para transferencia y botones", () => {
    const { html, text } = buildConfirmationEmail(data(), NOW);
    for (const piece of [
      "¡Recibimos tu pedido #0042!",
      "A domicilio · Lo antes posible",
      "2× Desayuno chapín",
      "Extra plátanos (+Q8.00)",
      "4a avenida 12-30, zona 10",
      "Q105.00",
      "Transferencia",
      "123-456789-0",
      "Ver mi pedido",
      "https://api.whatsapp.com/send?phone=50255550000",
    ])
      expect(html).toContain(piece);
    expect(text).toContain("Total: Q105.00");
    expect(text).toContain(
      "Banco Industrial · Monetaria · 123-456789-0 · a nombre de Café El Portal, S.A.",
    );
    expect(text).toContain(
      "Mira el estado de tu pedido: https://qr-menu.app/cafe-el-portal/zona-10/pedido/7f3a",
    );
  });

  it("sin transferencia no muestra cuentas; programado dice la hora", () => {
    const { html, text } = buildConfirmationEmail(
      data({
        order: order({
          payment: "cash",
          orderType: "takeout",
          deliveryFeeCents: 0,
          scheduledFor: gtInstant(addDays(TODAY, 1), 7 * 60 + 30),
        }),
      }),
      NOW,
    );
    expect(html).not.toContain("123-456789-0");
    expect(text).not.toContain("transferencia");
    expect(text).toContain("Para llevar · Programado para mañana 7:30");
  });

  it("escapa lo que escribió el comensal o el negocio", () => {
    const { html, subject } = buildConfirmationEmail(
      data({
        order: order({ customerName: '<script>alert("x")</script>', businessName: "Tacos & Más" }),
        primaryColor: "red;background:url(x)",
      }),
      NOW,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Tacos &amp; Más");
    expect(html).not.toContain("url(x)");
    expect(subject).toContain("Tacos & Más");
  });
});

describe("envío con Resend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sin RESEND_API_KEY no se envía nada", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(emailEnabled()).toBe(false);
    expect(
      await sendEmail({
        to: "maria@correo.com",
        subject: "s",
        html: "h",
        text: "t",
        fromName: "Café",
      }),
    ).toEqual({ sent: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con llave: POST a Resend al comensal, remitente 'Negocio vía Marca' y responder-a del negocio", async () => {
    vi.stubEnv("RESEND_API_KEY", "x".repeat(24));
    vi.stubEnv("EMAIL_FROM", "pedidos@ejemplo.com");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendEmail({
      to: "maria@correo.com",
      subject: "Recibimos tu pedido",
      html: "<p>hola</p>",
      text: "hola",
      fromName: 'Café "El" <Portal>',
      replyTo: "hola@cafe.com",
    });
    expect(result).toEqual({ sent: true, id: "abc" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      to: ["maria@correo.com"],
      reply_to: "hola@cafe.com",
      subject: "Recibimos tu pedido",
    });
    expect(body.from).toMatch(/^"Café El Portal vía .+" <pedidos@ejemplo\.com>$/);
  });

  it("si Resend responde error, lanza (lo registra quien llama)", async () => {
    vi.stubEnv("RESEND_API_KEY", "x".repeat(24));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid", { status: 422 })));
    await expect(
      sendEmail({ to: "maria@correo.com", subject: "s", html: "h", text: "t", fromName: "Café" }),
    ).rejects.toThrow("Resend respondió 422");
  });

  it("remitente por defecto: pedidos@ el dominio de la app", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(senderAddress()).toMatch(/^pedidos@[\w.-]+$/);
  });
});
