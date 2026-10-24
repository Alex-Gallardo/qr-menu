import type { Metadata } from "next";
import { LegalPage } from "@/features/marketing/components/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacidad",
  description: `Qué datos guarda ${BRAND.name}, para qué los usa y cómo puedes pedir que se borren.`,
  alternates: { canonical: "/legal/privacidad" },
};

export default function PrivacyPage() {
  const name = BRAND.name;
  return (
    <LegalPage title="Política de privacidad" updated="24 de octubre de 2026">
      <section>
        <h2>Lo que guardamos</h2>
        <ul>
          <li>
            <strong>De los negocios:</strong> nombre, correo y nombre de quienes usan el panel;
            datos de las sucursales (dirección, WhatsApp, horarios), menú, fotos y boletas de pago.
          </li>
          <li>
            <strong>De quienes piden:</strong> nombre, teléfono, el pedido y, si es a domicilio, la
            dirección y la ubicación que comparten. El correo solo si lo dejan para recibir la
            confirmación.
          </li>
          <li>
            <strong>Uso del menú:</strong> visitas, productos vistos y escaneos de QR, con un
            identificador aleatorio del dispositivo (sin nombre ni teléfono) para las analíticas del
            negocio.
          </li>
        </ul>
      </section>
      <section>
        <h2>Para qué lo usamos</h2>
        <ul>
          <li>Para que el menú funcione y el pedido le llegue al negocio.</li>
          <li>Para mandar la confirmación del pedido al cliente que dejó su correo.</li>
          <li>Para las analíticas del propio negocio y para mejorar el servicio.</li>
          <li>Para cobrar y verificar los pagos de los planes.</li>
        </ul>
        <p>No vendemos datos ni los usamos para publicidad de terceros.</p>
      </section>
      <section>
        <h2>Quién más los ve</h2>
        <p>
          El negocio ve los pedidos que le hacen. Usamos proveedores para operar: alojamiento y base
          de datos, envío de correos, registro de errores y, en las páginas públicas de {name},
          Google Analytics sin señales publicitarias. Ellos solo procesan lo necesario para su
          función.
        </p>
      </section>
      <section>
        <h2>Cuánto tiempo</h2>
        <p>
          Mientras la cuenta del negocio esté activa. Si se cierra, guardamos los datos 90 días y
          luego los borramos, salvo lo que la ley obligue a conservar. Los límites de seguridad (por
          ejemplo, intentos de PIN) se guardan solo unas horas.
        </p>
      </section>
      <section>
        <h2>Tus derechos</h2>
        <p>
          Puedes pedir ver, corregir o borrar tus datos. Si pediste en un restaurante, escríbele al
          negocio o a nosotros y lo resolvemos con ellos. Respondemos en un plazo razonable.
        </p>
      </section>
      <section>
        <h2>Seguridad</h2>
        <p>
          La conexión siempre va cifrada, los PIN y los enlaces de invitación se guardan solo como
          huellas (no en claro), las boletas de pago están en un almacenamiento privado y el equipo
          de la plataforma entra con verificación en dos pasos, dejando registro de cada acción.
        </p>
      </section>
    </LegalPage>
  );
}
