"use client";

import {
  BranchSelector,
  type SelectorBranch,
} from "@/features/public-menu/components/branch-selector";
import { buildWhatsAppMessage, whatsappUrl, type MessageOrder } from "@/features/orders/whatsapp";
import { MenuShell } from "@/features/public-menu/templates/clasico/components";
import { OrderConfirmation } from "@/features/public-menu/templates/clasico/order-confirmation";
import { themeFromPreset } from "@/features/public-menu/theme";
import { useStyleguideTheme } from "./theme-context";

const EVERY_DAY = (opens: string, closes: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes }));

const BRANCHES: SelectorBranch[] = [
  {
    slug: "zona-1",
    name: "Zona 1",
    address: "6a avenida 8-20",
    city: "Ciudad de Guatemala",
    lat: 14.6427,
    lng: -90.5133,
    isActive: true,
    hours: EVERY_DAY("07:00", "21:00"),
  },
  {
    slug: "antigua",
    name: "Antigua",
    address: "5a calle poniente 12",
    city: "Antigua Guatemala",
    lat: 14.5586,
    lng: -90.7295,
    isActive: true,
    hours: EVERY_DAY("06:30", "22:00"),
  },
  {
    slug: "xela",
    name: "Xela",
    address: null,
    city: "Quetzaltenango",
    lat: null,
    lng: null,
    isActive: false,
    hours: [],
  },
];

const ORDER: MessageOrder = {
  number: 42,
  businessName: "Café El Portal",
  branchName: "Antigua",
  customerName: "Ana López",
  customerPhone: "+50255551234",
  orderType: "takeout",
  tableLabel: null,
  scheduledFor: null,
  items: [
    {
      name: "Desayuno chapín",
      quantity: 2,
      lineCents: 9000,
      options: [{ group: "Huevos", name: "Estrellados", deltaCents: 0 }],
      note: null,
    },
    { name: "Café de olla", quantity: 2, lineCents: 3000, options: [], note: "Sin azúcar" },
  ],
  subtotalCents: 12000,
  deliveryFeeCents: 0,
  totalCents: 12000,
  payment: "transfer",
  bankName: "Banco Industrial",
  address: null,
  addressReference: null,
  location: null,
  note: null,
  detailUrl: "https://ejemplo.com/cafe-el-portal/antigua/pedido/demo",
  greeting: null,
  farewell: null,
};
const PHONE = "+50255550000";
const MESSAGE = buildWhatsAppMessage(ORDER, new Date("2026-10-26T16:00:00Z"));

/** Selector de sucursal y confirmación del pedido (con las estrellas de la reseña). */
export function PublicMenuExtras() {
  const { menuPalette } = useStyleguideTheme();
  const theme = themeFromPreset(menuPalette);
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <h3 className="type-h3">Selector de sucursal</h3>
        <p className="type-small text-muted-foreground">
          Cuando el negocio tiene varias sucursales y el QR no dice cuál. “Usar mi ubicación” las
          ordena por cercanía.
        </p>
        <MenuShell theme={theme} className="min-h-0 overflow-hidden rounded-lg [&>div]:p-4">
          <BranchSelector businessSlug="cafe-el-portal" branches={BRANCHES} />
        </MenuShell>
      </div>
      <div className="grid content-start gap-3">
        <h3 className="type-h3">Pedido enviado</h3>
        <p className="type-small text-muted-foreground">
          Check con rebote y confeti, reenviar por WhatsApp, cuentas para transferencia y “¿Qué tal
          estuvo todo?” con estrellas. Aquí la reseña no se guarda.
        </p>
        <MenuShell theme={theme} className="min-h-0 overflow-hidden rounded-lg">
          <OrderConfirmation
            embedded
            orderId="styleguide"
            status="delivered"
            statusLabel="Entregado"
            order={ORDER}
            branchWhatsapp={PHONE}
            message={MESSAGE}
            whatsappUrl={whatsappUrl(PHONE, MESSAGE)}
            bankAccounts={[
              {
                id: "bi",
                bankName: "Banco Industrial",
                accountType: "Monetaria",
                accountNumber: "000-000000-0",
                holderName: "Café El Portal, S.A.",
                instructions: "Envía la foto de tu boleta por WhatsApp.",
              },
            ]}
            menuHref="#publico"
            emailNotice
            review={{ open: true, review: null, googleUrl: null }}
          />
        </MenuShell>
      </div>
    </div>
  );
}
