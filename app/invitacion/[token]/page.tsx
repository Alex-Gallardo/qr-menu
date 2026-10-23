import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormSkeleton } from "@/features/auth/components/auth-card";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { AcceptInvitation } from "@/features/team/components/accept-invitation";
import { getInvitation } from "@/features/team/server";
import { branchesLabel, invitePath } from "@/features/team/team";
import { getAuthUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Invitación al equipo",
  robots: { index: false, follow: false },
};

/**
 * Invitación de encargado: muestra a qué negocio y sucursales; para aceptar
 * hay que entrar (o crear la cuenta) con el correo invitado.
 */
export default function Page({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <Suspense
      fallback={
        <AuthCard title="Invitación al equipo">
          <FormSkeleton fields={1} />
        </AuthCard>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[\w-]{20,100}$/.test(token);
  const [invitation, user] = await Promise.all([
    valid ? getInvitation(token) : null,
    getAuthUser(),
  ]);

  if (!invitation || invitation.state === "revoked")
    return (
      <AuthCard title="Esta invitación no es válida">
        <p className="type-body text-muted-foreground">
          Puede que la hayan cancelado o que el link esté incompleto. Pide al dueño del negocio que
          te invite otra vez.
        </p>
      </AuthCard>
    );

  const business = invitation.business;
  const branches = branchesLabel(invitation.all_branches, invitation.branch_ids, business.branches);
  const path = invitePath(token);
  const signedIn = user && !user.isAnonymous ? user : null;
  const sameEmail = signedIn?.email?.toLowerCase() === invitation.email;

  return (
    <AuthCard title={`Te invitan a ${business.name}`} subtitle={`Como encargado de: ${branches}.`}>
      <div className="grid gap-4">
        {invitation.state === "expired" ? (
          <p className="type-body rounded-md bg-muted px-3 py-2">
            Esta invitación venció. Pide al dueño que te la reenvíe desde Equipo.
          </p>
        ) : invitation.state === "accepted" ? (
          <>
            <p className="type-body">Ya aceptaste esta invitación.</p>
            <Button asChild>
              <Link href="/panel">Ir al panel</Link>
            </Button>
          </>
        ) : !signedIn ? (
          <>
            <p className="type-body text-muted-foreground">
              Entra o crea tu cuenta con <strong className="break-all">{invitation.email}</strong>{" "}
              para aceptar.
            </p>
            <Button asChild>
              <Link href={`/entrar?next=${encodeURIComponent(path)}`}>Ya tengo cuenta: entrar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/registro?next=${encodeURIComponent(path)}&correo=${encodeURIComponent(invitation.email)}`}
              >
                Crear mi cuenta
              </Link>
            </Button>
          </>
        ) : sameEmail ? (
          <AcceptInvitation token={token} businessName={business.name} />
        ) : (
          <>
            <p className="type-body">
              Esta invitación es para <strong className="break-all">{invitation.email}</strong>, y
              entraste como <strong className="break-all">{signedIn.email}</strong>. Sal y entra con
              el correo invitado.
            </p>
            <SignOutButton />
          </>
        )}
      </div>
    </AuthCard>
  );
}
