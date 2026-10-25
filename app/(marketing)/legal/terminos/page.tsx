import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/components/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: `Condiciones para usar ${BRAND.name}: cuentas, planes y pagos, contenido de tu menú y responsabilidades.`,
  alternates: { canonical: "/legal/terminos" },
};

export default function TermsPage() {
  const name = BRAND.name;
  return (
    <LegalPage title="Términos de uso" updated="24 de octubre de 2026">
      <section>
        <h2>1. Qué es {name}</h2>
        <p>
          {name} es un servicio para que restaurantes y negocios de comida publiquen su menú digital
          con código QR y reciban pedidos por WhatsApp. Al crear una cuenta o usar el servicio
          aceptas estos términos.
        </p>
      </section>
      <section>
        <h2>2. Tu cuenta</h2>
        <ul>
          <li>Eres responsable de los datos que registras y de cuidar tu contraseña.</li>
          <li>
            Puedes invitar encargados y crear staff con PIN; lo que hagan en tu cuenta es tu
            responsabilidad.
          </li>
          <li>Debes tener al menos 18 años o actuar en nombre de un negocio que lo autorice.</li>
        </ul>
      </section>
      <section>
        <h2>3. Planes, prueba y pagos</h2>
        <ul>
          <li>
            Las cuentas nuevas tienen una prueba gratis; al terminar, la cuenta pasa al plan Gratis
            si no pagas.
          </li>
          <li>
            Los planes pagados se cobran por adelantado, mensual o anual, por transferencia o
            depósito. El plan se activa al verificar tu boleta.
          </li>
          <li>
            Si un plan vence, tienes días de gracia para renovar; después pasas al plan Gratis. Lo
            que exceda sus límites se oculta, no se borra.
          </li>
          <li>
            No cobramos comisión por pedido. Los pagos de tus clientes se hacen directo contigo.
          </li>
          <li>
            Los precios pueden cambiar; te avisaremos antes y se aplican desde tu siguiente periodo.
          </li>
        </ul>
      </section>
      <section>
        <h2>4. Tu contenido</h2>
        <p>
          El menú, las fotos, los textos y los logos que subes son tuyos. Nos das permiso para
          mostrarlos y procesarlos solo para prestar el servicio (por ejemplo, para publicar tu menú
          y mostrar tu logo en el código QR). Debes tener derecho a usar lo que publicas y mantener
          tus precios y datos al día.
        </p>
      </section>
      <section>
        <h2>5. Pedidos y tus clientes</h2>
        <p>
          {name} ordena el pedido y lo manda a tu WhatsApp. La venta, la preparación, la entrega,
          los cobros, las facturas y la atención al cliente son responsabilidad de tu negocio.
        </p>
      </section>
      <section>
        <h2>6. Uso aceptable</h2>
        <ul>
          <li>No uses el servicio para vender productos ilegales ni para engañar a nadie.</li>
          <li>No intentes acceder a cuentas ajenas ni afectar el funcionamiento del servicio.</li>
          <li>Podemos pausar una cuenta que incumpla estos términos; te avisaremos el motivo.</li>
        </ul>
      </section>
      <section>
        <h2>7. Disponibilidad y responsabilidad</h2>
        <p>
          Trabajamos para que el servicio esté disponible siempre, pero puede haber pausas por
          mantenimiento o fallas de terceros (internet, WhatsApp, proveedores). En la medida que la
          ley lo permita, nuestra responsabilidad se limita a lo que pagaste en los últimos tres
          meses.
        </p>
      </section>
      <section>
        <h2>8. Cancelación</h2>
        <p>
          Puedes dejar de usar el servicio cuando quieras: si no renuevas, tu cuenta pasa al plan
          Gratis. Si nos pides cerrar tu cuenta, conservamos tus datos 90 días por si cambias de
          idea y luego los borramos, salvo lo que la ley nos obligue a guardar.
        </p>
      </section>
      <section>
        <h2>9. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes de la República de Guatemala. Si tienes una duda o
          un reclamo, escríbenos primero: casi todo se resuelve hablando.
        </p>
      </section>
    </LegalPage>
  );
}
