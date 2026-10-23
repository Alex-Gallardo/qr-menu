/**
 * Encabezados de seguridad para todas las respuestas (next.config.ts):
 * - Ningún otro sitio puede meter la app en un <iframe> (evita "clickjacking"
 *   sobre el panel o la bandeja del staff: aceptar, cancelar, revocar…). La
 *   propia app sí: el asistente muestra el menú real en un marco de celular.
 * - El navegador no adivina tipos de archivo.
 * - Al salir a otro sitio solo viaja el origen, nunca la ruta (los links de
 *   confirmación de pedido llevan el id).
 * - Ubicación solo para la propia app (pedido a domicilio); cámara,
 *   micrófono y pagos del navegador, apagados.
 * (Una CSP completa para scripts queda pendiente: el splash y el JSON-LD usan
 * scripts en línea.)
 */
export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
] as const;
