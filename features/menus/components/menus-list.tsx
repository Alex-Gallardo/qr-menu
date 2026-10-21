"use client";

import {
  CopyIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
  UtensilsCrossedIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createMenuAction,
  duplicateMenuAction,
  makeDefaultMenu,
  removeMenu,
  toggleMenu,
  undoRemoveMenu,
} from "../actions";
import type { MenuRow } from "../server";
import { MENU_TEMPLATES, statsLabel } from "../structure";

export function MenusList({
  businessId,
  menus,
  menusHref,
  canCreate,
  limitNotice,
}: {
  businessId: string;
  menus: MenuRow[];
  /** /panel/{negocio}/menus */
  menusHref: string;
  canCreate: boolean;
  limitNotice?: React.ReactNode;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);
  const [pendingActive, setPendingActive] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const visible = menus
    .filter((m) => !hidden.includes(m.id))
    .map((m) => (m.id in pendingActive ? { ...m, is_active: pendingActive[m.id]! } : m));

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message ?? "No pudimos guardar el cambio.");
      else if (res.message) toast.success(res.message);
      router.refresh();
    });

  const toggle = (menuId: string, active: boolean) => {
    setPendingActive((p) => ({ ...p, [menuId]: active }));
    startTransition(async () => {
      const res = await toggleMenu({ businessId, menuId, active });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
      setPendingActive((p) => {
        const next = { ...p };
        delete next[menuId];
        return next;
      });
    });
  };

  const remove = (menu: MenuRow) => {
    // Fuera de la transición: se oculta al instante, sin esperar al servidor.
    setHidden((h) => [...h, menu.id]);
    startTransition(async () => {
      const res = await removeMenu({ businessId, menuId: menu.id });
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== menu.id));
        toast.error(res.message);
        return;
      }
      router.refresh();
      const extra = [
        res.data.schedules > 0 ? `con su programación (${res.data.schedules})` : null,
        res.data.wasDefault ? "Elige otro predeterminado" : null,
      ].filter(Boolean);
      toast(`Menú eliminado${extra.length ? ` · ${extra.join(" · ")}` : ""}`, {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await undoRemoveMenu({ businessId, menuId: menu.id });
            if (undo.ok) {
              setHidden((h) => h.filter((id) => id !== menu.id));
              toast.success(undo.message);
              router.refresh();
            } else {
              toast.error(undo.message);
            }
          },
        },
      });
    });
  };

  return (
    <div className="grid gap-5">
      {canCreate ? <NewMenuForm businessId={businessId} menusHref={menusHref} /> : limitNotice}

      {visible.length === 0 ? (
        <EmptyState icon={<UtensilsCrossedIcon />} title="Aún no tienes menús">
          Un menú agrupa productos de tu catálogo en secciones: Desayunos, Almuerzo ejecutivo,
          Carta…
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {visible.map((menu) => (
            <li
              key={menu.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-1 sm:p-5"
            >
              <div
                className={cn(
                  "grid w-full min-w-0 gap-1 sm:w-auto sm:flex-1",
                  !menu.is_active && "opacity-60",
                )}
              >
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`${menusHref}/${menu.id}`} className="type-h3 hover:underline">
                    {menu.name}
                  </Link>
                  {menu.is_default ? (
                    <span className="type-caption inline-flex items-center gap-1 rounded-full bg-maiz/30 px-2 py-0.5 font-semibold">
                      <StarIcon aria-hidden className="size-3" />
                      Predeterminado
                    </span>
                  ) : null}
                  {!menu.is_active ? (
                    <span className="type-caption rounded-full bg-muted px-2 py-0.5 font-semibold">
                      En pausa
                    </span>
                  ) : null}
                  {menu.hidden_by_license ? (
                    <span className="type-caption rounded-full bg-muted px-2 py-0.5 font-semibold">
                      Oculto por tu plan
                    </span>
                  ) : null}
                </p>
                {menu.description ? (
                  <p className="type-small line-clamp-2 text-muted-foreground">
                    {menu.description}
                  </p>
                ) : null}
                <p className="type-caption text-muted-foreground">
                  {statsLabel({ sections: menu.sectionCount, items: menu.itemCount })} · Plantilla{" "}
                  {MENU_TEMPLATES.find((t) => t.value === (menu.template ?? "clasico"))?.label}
                  {menu.scheduleCount > 0
                    ? ` · ${menu.scheduleCount === 1 ? "1 regla" : `${menu.scheduleCount} reglas`} de programación`
                    : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="type-small text-muted-foreground">Activo</span>
                  <Switch
                    checked={menu.is_active}
                    disabled={menu.is_default}
                    title={menu.is_default ? "El predeterminado siempre está activo" : undefined}
                    onCheckedChange={(v) => toggle(menu.id, v)}
                    aria-label={`${menu.name} activo`}
                  />
                </label>
                <Button asChild variant="outline" size="sm">
                  <Link href={`${menusHref}/${menu.id}`}>
                    <PencilIcon />
                    Editar
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Más opciones de ${menu.name}`}>
                      <EllipsisVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      className="min-h-11"
                      onSelect={() =>
                        run(() => duplicateMenuAction({ businessId, menuId: menu.id }))
                      }
                    >
                      <CopyIcon />
                      Duplicar
                    </DropdownMenuItem>
                    {!menu.is_default ? (
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => run(() => makeDefaultMenu({ businessId, menuId: menu.id }))}
                      >
                        <StarIcon />
                        Hacer predeterminado
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="min-h-11"
                      onSelect={() => remove(menu)}
                    >
                      <Trash2Icon />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="type-small text-muted-foreground">
        El <strong>predeterminado</strong> se muestra cuando ninguna programación aplica (por
        ejemplo, fuera de tus franjas).
      </p>
    </div>
  );
}

/** Crear es un paso: nombre → al editor, donde se agregan secciones y productos. */
function NewMenuForm({ businessId, menusHref }: { businessId: string; menusHref: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startCreate(async () => {
      const res = await createMenuAction({ businessId, name });
      if (!res.ok) return setError(res.message);
      router.push(`${menusHref}/${res.data.menuId}`);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="flex gap-2">
        <label htmlFor="new-menu" className="sr-only">
          Nombre del menú nuevo
        </label>
        <Input
          id="new-menu"
          value={name}
          maxLength={60}
          placeholder="Ej.: Almuerzo ejecutivo"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" loading={creating} disabled={name.trim().length < 2}>
          <PlusIcon />
          Crear menú
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  );
}
