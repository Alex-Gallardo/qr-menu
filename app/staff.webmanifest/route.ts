import { appManifest } from "@/features/notifications/manifest";

/** Manifiesto de la app instalable (staff). Estático: se genera en el build. */
export function GET() {
  return Response.json(appManifest("staff"), {
    headers: { "content-type": "application/manifest+json" },
  });
}
