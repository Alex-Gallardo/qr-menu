/**
 * Textos listos para que el negocio anuncie su menú (guía §17, "Copys que se
 * entregan a cada negocio"), con su nombre y el link de la sucursal.
 */
export function shareTexts(businessName: string, link: string) {
  return [
    {
      id: "estado",
      title: "Estado de WhatsApp / historia de Instagram",
      text: `¡Estrenamos menú digital! 🎉 Mira nuestro menú del día y haz tu pedido aquí: ${link}. Te llega directo a nuestro WhatsApp.`,
    },
    {
      id: "publicacion",
      title: "Publicación de Instagram o Facebook",
      text: `Ahora pedir en ${businessName} es más fácil 🙌 Escanea el QR en tu mesa o entra a ${link}, elige lo que se te antoja y envía tu pedido por WhatsApp. Si es a domicilio, comparte tu ubicación y llegamos directo. ¡Buen provecho!`,
    },
    {
      id: "mesa",
      title: "Texto del porta-QR de mesa",
      text: "Escanea y pide 📱 Menú del día · Pedidos por WhatsApp",
    },
    {
      id: "difusion",
      title: "Mensaje para lista de difusión",
      text: `¡Hola! 👋 Te compartimos nuestro nuevo menú digital: ${link}. Ahí siempre vas a ver el menú del día actualizado y puedes dejar tu pedido programado aunque estemos cerrados. Agrégalo a tu pantalla de inicio para pedir más rápido.`,
    },
  ];
}
