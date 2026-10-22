import { buildConfirmationEmail } from "@/features/orders/email-template";
import { BRAND } from "@/lib/brand";
import { Section } from "./section";

// Pedido de ejemplo (a domicilio con transferencia: el caso más completo).
const SAMPLE = buildConfirmationEmail({
  order: {
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
        options: [
          { group: "Frijoles", name: "Volteados", deltaCents: 0 },
          { group: "Extras", name: "Extra plátanos", deltaCents: 800 },
        ],
        note: "Sin cebolla",
      },
      { name: "Americano grande", quantity: 1, lineCents: 1800, options: [], note: null },
    ],
    subtotalCents: 11600,
    deliveryFeeCents: 1500,
    totalCents: 13100,
    payment: "transfer",
    bankName: "Banco Industrial",
    address: "4a avenida 12-30, zona 10",
    addressReference: "Portón negro frente a la farmacia",
    location: null,
    note: null,
    detailUrl: `${BRAND.url}/cafe-el-portal/zona-10/pedido/ejemplo`,
    greeting: null,
    farewell: null,
  },
  statusUrl: `${BRAND.url}/cafe-el-portal/zona-10/pedido/ejemplo`,
  branchWhatsapp: "+50255550000",
  bankAccounts: [
    {
      bankName: "Banco Industrial",
      accountType: "Monetaria",
      accountNumber: "000-000000-0",
      holderName: "Café El Portal, S.A.",
      instructions: "Envía tu boleta por WhatsApp con tu número de pedido.",
    },
  ],
  logoUrl: null,
  primaryColor: "#D23B22",
  onPrimaryColor: "#FFFFFF",
  brandName: BRAND.name,
});

export function EmailSection() {
  return (
    <Section
      id="correos"
      number={13}
      title="Correo de confirmación"
      description="Lo recibe solo el comensal que dejó su correo (nunca el negocio). HTML con tablas y estilos en línea para Gmail y Outlook, más versión de texto. Es la plantilla real con un pedido de ejemplo."
    >
      <div className="grid gap-4 lg:grid-cols-[520px_1fr]">
        <iframe
          title="Vista previa del correo de confirmación"
          srcDoc={SAMPLE.html}
          sandbox=""
          className="h-[900px] w-full max-w-[520px] rounded-lg border border-border bg-white"
        />
        <div className="grid content-start gap-2">
          <p className="type-small">
            <strong>Asunto:</strong> {SAMPLE.subject}
          </p>
          <pre className="type-caption max-h-[820px] overflow-auto rounded-lg bg-muted p-4 whitespace-pre-wrap">
            {SAMPLE.text}
          </pre>
        </div>
      </div>
    </Section>
  );
}
