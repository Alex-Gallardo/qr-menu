import {
  APP_ICON_VARIANTS,
  appIconFor,
  type AppIconVariant,
} from "@/features/notifications/app-icon";

/** /app-icon/192, /app-icon/512 y /app-icon/maskable (manifiestos del panel y del staff). */
export function generateStaticParams() {
  return APP_ICON_VARIANTS.map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: RouteContext<"/app-icon/[variant]">) {
  const { variant } = await params;
  if (!APP_ICON_VARIANTS.includes(variant as AppIconVariant))
    return new Response("No encontrado", { status: 404 });
  return appIconFor(variant as AppIconVariant);
}
