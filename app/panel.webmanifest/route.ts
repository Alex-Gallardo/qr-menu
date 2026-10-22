import { appManifest } from "@/features/notifications/manifest";

/** Manifiesto de la app instalable (panel). Estático: se genera en el build. */
export function GET() {
  return Response.json(appManifest("panel"), {
    headers: { "content-type": "application/manifest+json" },
  });
}
