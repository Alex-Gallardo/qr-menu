"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ImageIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UtensilsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { EmptyState } from "@/components/feedback/empty-state";
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
import { formatQ } from "@/lib/money";
import {
  duplicate,
  moveProductAction,
  removeProduct,
  setAvailability,
  undoRemoveProduct,
} from "../actions";
import {
  matchesSearch,
  PRODUCT_TAGS,
  soldOutBranchIds,
  viewForBranch,
  type BranchSetting,
} from "../catalog";
import type { CatalogProductRow } from "../server";

type Branch = { id: string; name: string };
type Category = { id: string; name: string };

type Props = {
  businessId: string;
  products: CatalogProductRow[];
  categories: Category[];
  /** Sucursales que el usuario ve (para "Agotado en…"). */
  branches: Branch[];
  /** Sucursal elegida en el selector del panel; null = todas. */
  branchId: string | null;
  /** Puede agotar en todas las sucursales (dueño o encargado de todas). */
  canToggleEverywhere: boolean;
  /** Ruta base del catálogo: /panel/{negocio}/productos */
  productsHref: string;
};

const NO_CATEGORY = "none";

/**
 * Lista del catálogo. Las tareas diarias en 2 toques: buscar → interruptor.
 * Los interruptores responden al instante y se revierten si el servidor falla.
 */
export function ProductCatalog({
  businessId,
  products,
  categories,
  branches,
  branchId,
  canToggleEverywhere,
  productsHref,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [hidden, setHidden] = useState<string[]>([]);
  /** Cambios optimistas: `${productId}:${branchId|"all"}` → disponible. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "otra sucursal";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const visible = products.filter(
    (p) =>
      !hidden.includes(p.id) &&
      (filter === "all" || (p.category_id ?? NO_CATEGORY) === filter) &&
      matchesSearch([p.name, p.description, categoryName.get(p.category_id ?? "")], query),
  );

  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    { id: NO_CATEGORY, name: "Sin categoría" },
  ]
    .map((g) => ({ ...g, items: visible.filter((p) => (p.category_id ?? NO_CATEGORY) === g.id) }))
    .filter((g) => g.items.length > 0);

  const hasUncategorized = products.some((p) => !p.category_id);
  const twoSwitches = branchId !== null && canToggleEverywhere;

  const toggle = (product: CatalogProductRow, scope: string | null, available: boolean) => {
    const key = `${product.id}:${scope ?? "all"}`;
    setPending((p) => ({ ...p, [key]: available }));
    startTransition(async () => {
      const res = await setAvailability({
        businessId,
        productId: product.id,
        available,
        ...(scope ? { branchId: scope } : {}),
      });
      if (!res.ok) toast.error(res.message);
      else
        toast.success(
          available
            ? `${product.name}: disponible${scope ? ` en ${branchName(scope)}` : ""}`
            : `${product.name}: agotado${scope ? ` solo en ${branchName(scope)}` : " en todas las sucursales"}`,
        );
      router.refresh();
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    });
  };

  const remove = (product: CatalogProductRow) => {
    // Fuera de la transición: se oculta al instante, sin esperar al servidor.
    setHidden((h) => [...h, product.id]);
    startTransition(async () => {
      const res = await removeProduct({ businessId, productId: product.id });
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== product.id));
        toast.error(res.message);
        return;
      }
      router.refresh();
      // Deshacer en vez de confirmar (6 s), como pide la guía.
      toast("Producto eliminado", {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await undoRemoveProduct({ businessId, productId: product.id });
            if (undo.ok) {
              setHidden((h) => h.filter((id) => id !== product.id));
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

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message ?? "No pudimos guardar el cambio.");
      else if (res.message) toast.success(res.message);
      router.refresh();
    });

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsIcon />}
        title="Tu catálogo está vacío"
        action={
          <Button asChild>
            <Link href={`${productsHref}/nuevo`}>Agregar mi primer producto</Link>
          </Button>
        }
      >
        Agrega tus platillos y bebidas con foto y precio. Luego los acomodas en tus menús.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Buscar producto</span>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto"
            className="pl-11"
          />
        </label>
        <div
          role="group"
          aria-label="Filtrar por categoría"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {[
            { id: "all", name: "Todas" },
            ...categories,
            ...(hasUncategorized ? [{ id: NO_CATEGORY, name: "Sin categoría" }] : []),
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
              className="type-small h-10 shrink-0 rounded-full border border-border bg-card px-4 font-semibold whitespace-nowrap transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="type-body py-8 text-center text-muted-foreground">
          No encontramos “{query}”. Prueba con otra palabra.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`cat-${group.id}`} className="grid gap-2">
          <h2 id={`cat-${group.id}`} className="type-small font-semibold text-muted-foreground">
            {group.name} · {group.items.length}
          </h2>
          <ul className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-1">
            {group.items.map((product, index) => {
              const everywhere = pending[`${product.id}:all`] ?? product.is_available;
              const settings = withPendingBranch(
                product.branch_settings,
                branchId,
                branchId ? pending[`${product.id}:${branchId}`] : undefined,
              );
              const view = branchId
                ? viewForBranch({ ...product, is_available: everywhere }, branchId, settings)
                : null;
              const here = branchId
                ? (settings.find((s) => s.branch_id === branchId)?.is_available ?? true)
                : null;
              const soldOutIn = soldOutBranchIds(settings);

              return (
                <li
                  key={product.id}
                  className={cn(
                    "p-3 sm:flex sm:items-center sm:gap-4 sm:p-4",
                    // Con dos interruptores no caben junto al nombre en el celular.
                    twoSwitches ? "grid gap-3" : "flex items-center gap-3",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Thumb url={product.image_url} dimmed={view ? !view.available : !everywhere} />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <Link
                        href={`${productsHref}/${product.id}`}
                        className="type-body line-clamp-2 font-semibold break-words hover:underline"
                      >
                        {product.name}
                      </Link>
                      <p className="type-small flex flex-wrap items-center gap-x-2 text-muted-foreground">
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatQ(view?.priceCents ?? product.price_cents)}
                        </span>
                        {view?.hasOwnPrice ? <span>precio de esta sucursal</span> : null}
                        {product.compare_at_cents && !view?.hasOwnPrice ? (
                          <s className="tabular-nums">{formatQ(product.compare_at_cents)}</s>
                        ) : null}
                        {product.tags.map((t) => (
                          <span key={t} className="type-caption rounded-full bg-nube px-2 py-0.5">
                            {PRODUCT_TAGS.find((x) => x.value === t)?.label ?? t}
                          </span>
                        ))}
                        {product._count.option_groups > 0 ? (
                          <span className="type-caption">Con opciones</span>
                        ) : null}
                      </p>
                      <Status
                        everywhere={everywhere}
                        soldOutIn={branchId ? [] : soldOutIn.map(branchName)}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-5">
                    {branchId && here !== null ? (
                      <ToggleLabel label="Aquí" hint={branchName(branchId)}>
                        <Switch
                          checked={everywhere && here}
                          disabled={!everywhere}
                          onCheckedChange={(v) => toggle(product, branchId, v)}
                          aria-label={`${product.name} disponible en ${branchName(branchId)}`}
                        />
                      </ToggleLabel>
                    ) : null}
                    {canToggleEverywhere ? (
                      <ToggleLabel label={branchId ? "Todas" : "Disponible"}>
                        <Switch
                          checked={everywhere}
                          onCheckedChange={(v) => toggle(product, null, v)}
                          aria-label={`${product.name} disponible en todas las sucursales`}
                        />
                      </ToggleLabel>
                    ) : null}
                    <RowMenu
                      name={product.name}
                      editHref={`${productsHref}/${product.id}`}
                      canMoveUp={index > 0 && !query && filter === "all"}
                      canMoveDown={index < group.items.length - 1 && !query && filter === "all"}
                      onDuplicate={() =>
                        run(() => duplicate({ businessId, productId: product.id }))
                      }
                      onMove={(direction) =>
                        run(() =>
                          moveProductAction({ businessId, productId: product.id, direction }),
                        )
                      }
                      onDelete={() => remove(product)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Aplica el cambio optimista de "Disponible aquí" a la configuración por sucursal. */
function withPendingBranch(
  settings: BranchSetting[],
  branchId: string | null,
  available: boolean | undefined,
): BranchSetting[] {
  if (!branchId || available === undefined) return settings;
  const current = settings.find((s) => s.branch_id === branchId);
  return [
    ...settings.filter((s) => s.branch_id !== branchId),
    {
      branch_id: branchId,
      is_available: available,
      price_override_cents: current?.price_override_cents ?? null,
    },
  ];
}

function Thumb({ url, dimmed }: { url: string | null; dimmed: boolean }) {
  return (
    <span
      className={cn(
        "grid aspect-[4/3] w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground",
        dimmed && "opacity-50 grayscale",
      )}
    >
      {url ? (
        // Fotos ya comprimidas (≤ 300 KB) o de ejemplo: sin optimizador en el panel.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <ImageIcon aria-hidden className="size-5" />
      )}
    </span>
  );
}

function Status({ everywhere, soldOutIn }: { everywhere: boolean; soldOutIn: string[] }) {
  if (!everywhere)
    return (
      <span className="type-caption font-semibold text-destructive">
        Agotado en todas las sucursales
      </span>
    );
  if (soldOutIn.length > 0)
    return (
      <span className="type-caption font-semibold text-tomate-700">
        Agotado en {soldOutIn.join(", ")}
      </span>
    );
  return null;
}

function ToggleLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid justify-items-center gap-1">
      {children}
      <span className="type-caption text-muted-foreground" title={hint}>
        {label}
      </span>
    </label>
  );
}

function RowMenu({
  name,
  editHref,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onMove,
  onDelete,
}: {
  name: string;
  editHref: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Más opciones de ${name}`}>
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href={editHref}>
            <PencilIcon />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={onDuplicate}>
          <CopyIcon />
          Duplicar
        </DropdownMenuItem>
        {canMoveUp ? (
          <DropdownMenuItem className="min-h-11" onSelect={() => onMove(-1)}>
            <ArrowUpIcon />
            Subir
          </DropdownMenuItem>
        ) : null}
        {canMoveDown ? (
          <DropdownMenuItem className="min-h-11" onSelect={() => onMove(1)}>
            <ArrowDownIcon />
            Bajar
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="min-h-11" onSelect={onDelete}>
          <Trash2Icon />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
