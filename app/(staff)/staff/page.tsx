import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthorizeDevice } from "@/features/staff/components/authorize-device";
import { PinPad } from "@/features/staff/components/pin-pad";
import { authorizableBranches, deviceFromToken, getStaffSession } from "@/features/staff/server";
import { STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Modo staff", robots: { index: false } };

/**
 * /staff en la tablet de la sucursal:
 * - con turno abierto → la bandeja;
 * - dispositivo autorizado → teclado de PIN;
 * - dueño o encargado con sesión → "Autorizar este dispositivo".
 */
export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center">
          <Skeleton className="h-96 w-72" />
        </main>
      }
    >
      <Content />
    </Suspense>
  );
}

async function Content() {
  const token = (await cookies()).get(STAFF_DEVICE_COOKIE)?.value;
  const user = await getAuthUser();
  if (user?.isAnonymous && (await getStaffSession(user.id, token))) redirect("/staff/pedidos");

  const device = await deviceFromToken(token);
  if (device && !device.branch.hidden_by_license)
    return (
      <PinPad
        businessName={device.business.name}
        logoUrl={device.business.logo_url}
        branchName={device.branch.name}
        deviceName={device.name}
      />
    );

  if (user && !user.isAnonymous)
    return (
      <main className="grid min-h-dvh place-items-center gap-6 px-4 py-8">
        <AuthorizeDevice options={await authorizableBranches(user.id)} />
      </main>
    );

  return (
    <main className="grid min-h-dvh place-content-center justify-items-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="type-h2">Este dispositivo no está autorizado</h1>
      <p className="type-body max-w-sm text-muted-foreground">
        Pide al dueño o encargado que entre aquí con su cuenta y toque “Autorizar este dispositivo”.
      </p>
      <Link href="/entrar?next=/staff" className="type-body font-semibold text-primary underline">
        Entrar como dueño o encargado
      </Link>
    </main>
  );
}
