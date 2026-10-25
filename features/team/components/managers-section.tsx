"use client";

import {
  CopyIcon,
  MailIcon,
  MessageCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  UserMinusIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorSection } from "@/features/appearance/components/controls";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { runAction } from "@/lib/action-client";
import {
  inviteManagerAction,
  removeMemberAction,
  renewInvitationAction,
  revokeInvitationAction,
  setMemberBranchesAction,
} from "../actions";
import { branchesLabel, inviteShareText } from "../team";
import { BranchPicker } from "./branch-picker";

type Branch = { id: string; name: string };
type Manager = {
  memberId: string;
  name: string | null;
  email: string | null;
  allBranches: boolean;
  branchIds: string[];
};
type Invitation = {
  id: string;
  email: string;
  allBranches: boolean;
  branchIds: string[];
  expired: boolean;
  /** "vence el 30 oct" (formateado en el servidor). */
  until: string;
};

/**
 * Encargados (solo el dueño): invitar por correo con sus sucursales, el link
 * para compartir por WhatsApp, reenviar o cancelar, cambiar sucursales y quitar.
 */
export function ManagersSection({
  businessId,
  businessName,
  branches,
  managers,
  invitations,
  limitMessage,
  licenseHref,
  emailOn,
}: {
  businessId: string;
  businessName: string;
  branches: Branch[];
  managers: Manager[];
  invitations: Invitation[];
  /** El plan ya no deja invitar más (contando las pendientes). */
  limitMessage: string | null;
  licenseHref: string;
  /** El envío de correos está activo; si no, solo el link. */
  emailOn: boolean;
}) {
  const router = useRouter();
  const [shared, setShared] = useState<{ email: string; link: string } | null>(null);

  return (
    <EditorSection
      title="Encargados"
      description="Ven y atienden los pedidos, y manejan productos y menús de sus sucursales. Solo tú ves esta parte."
    >
      {managers.length === 0 && invitations.length === 0 ? (
        <p className="type-body text-muted-foreground">Todavía no invitas a nadie.</p>
      ) : (
        <ul className="grid gap-3">
          {managers.map((m) => (
            <ManagerRow
              key={m.memberId}
              businessId={businessId}
              branches={branches}
              manager={m}
              onChanged={() => router.refresh()}
            />
          ))}
          {invitations.map((inv) => (
            <InvitationRow
              key={inv.id}
              businessId={businessId}
              branches={branches}
              invitation={inv}
              onLink={(link) => setShared({ email: inv.email, link })}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      {shared ? (
        <ShareLink
          email={shared.email}
          link={shared.link}
          businessName={businessName}
          onClose={() => setShared(null)}
        />
      ) : null}

      {limitMessage ? (
        <LimitCard message={limitMessage} licenseHref={licenseHref} />
      ) : (
        <InviteForm
          businessId={businessId}
          branches={branches}
          emailOn={emailOn}
          onInvited={(email, link) => {
            setShared({ email, link });
            router.refresh();
          }}
        />
      )}
    </EditorSection>
  );
}

function InviteForm({
  businessId,
  branches,
  emailOn,
  onInvited,
}: {
  businessId: string;
  branches: Branch[];
  emailOn: boolean;
  onInvited: (email: string, link: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState({
    allBranches: branches.length === 1,
    branchIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await runAction(() => inviteManagerAction({ businessId, email, ...access }));
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(res.message);
      onInvited(email.trim().toLowerCase(), res.data.link);
      setEmail("");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border p-4">
      <h3 className="type-body font-semibold">Invitar encargado</h3>
      <Field
        id="invite-email"
        label="Correo"
        hint={
          emailOn
            ? "Le llega un correo con el link; también te lo damos para mandarlo por WhatsApp."
            : "Te damos el link para mandárselo por WhatsApp."
        }
      >
        <Input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          placeholder="ana@correo.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {branches.length > 1 ? (
        <BranchPicker
          id="invite"
          branches={branches}
          allBranches={access.allBranches}
          branchIds={access.branchIds}
          onChange={setAccess}
        />
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Button type="submit" loading={pending} className="justify-self-start">
        <UserPlusIcon aria-hidden />
        Invitar
      </Button>
    </form>
  );
}

function ManagerRow({
  businessId,
  branches,
  manager,
  onChanged,
}: {
  businessId: string;
  branches: Branch[];
  manager: Manager;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [access, setAccess] = useState({
    allBranches: manager.allBranches,
    branchIds: manager.branchIds,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const res = await runAction(() =>
        setMemberBranchesAction({ businessId, memberId: manager.memberId, ...access }),
      );
      if (!res.ok) return setError(res.message);
      toast.success(res.message);
      setEditing(false);
      onChanged();
    });

  const remove = () =>
    start(async () => {
      const res = await runAction(() =>
        removeMemberAction({ businessId, memberId: manager.memberId }),
      );
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      onChanged();
    });

  return (
    <li className="grid gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="type-body font-semibold">{manager.name ?? manager.email ?? "Encargado"}</p>
          <p className="type-small text-muted-foreground">
            {[
              manager.name ? manager.email : null,
              branchesLabel(manager.allBranches, manager.branchIds, branches),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {confirm ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={pending}
              onClick={remove}
            >
              Quitar acceso
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              No
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            {branches.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
                <PencilIcon aria-hidden />
                Sucursales
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
              <UserMinusIcon aria-hidden />
              Quitar
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="grid gap-3 border-t border-border pt-3">
          <BranchPicker
            id={`m-${manager.memberId}`}
            branches={branches}
            allBranches={access.allBranches}
            branchIds={access.branchIds}
            onChange={setAccess}
            error={error ?? undefined}
          />
          <Button
            type="button"
            size="sm"
            loading={pending}
            onClick={save}
            className="justify-self-start"
          >
            Guardar sucursales
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function InvitationRow({
  businessId,
  branches,
  invitation,
  onLink,
  onChanged,
}: {
  businessId: string;
  branches: Branch[];
  invitation: Invitation;
  onLink: (link: string) => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();

  const renew = () =>
    start(async () => {
      const res = await runAction(() =>
        renewInvitationAction({ businessId, invitationId: invitation.id }),
      );
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      onLink(res.data.link);
      onChanged();
    });

  const revoke = () =>
    start(async () => {
      const res = await runAction(() =>
        revokeInvitationAction({ businessId, invitationId: invitation.id }),
      );
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      onChanged();
    });

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
      <MailIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="type-body font-semibold break-all">{invitation.email}</p>
        <p className="type-small text-muted-foreground">
          {invitation.expired ? "Invitación vencida" : `Invitación pendiente · ${invitation.until}`}{" "}
          · {branchesLabel(invitation.allBranches, invitation.branchIds, branches)}
        </p>
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={renew}>
          <RefreshCwIcon aria-hidden />
          Reenviar
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={revoke}>
          <XIcon aria-hidden />
          Cancelar
        </Button>
      </div>
    </li>
  );
}

function ShareLink({
  email,
  link,
  businessName,
  onClose,
}: {
  email: string;
  link: string;
  businessName: string;
  onClose: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar.");
    }
  };
  return (
    <div role="status" className="grid gap-3 rounded-lg border border-success/40 bg-success/10 p-4">
      <p className="type-small">
        Link de invitación para <strong className="break-all">{email}</strong> (vale 7 días; debe
        entrar con ese correo):
      </p>
      <p className="type-small rounded-md bg-card px-3 py-2 font-mono break-all">{link}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          <CopyIcon aria-hidden />
          Copiar link
        </Button>
        <Button asChild size="sm" variant="whatsapp">
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteShareText(businessName, link))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircleIcon aria-hidden />
            Mandar por WhatsApp
          </a>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Listo
        </Button>
      </div>
    </div>
  );
}
