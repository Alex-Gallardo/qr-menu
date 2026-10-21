"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveCategoryAction, removeCategory, saveCategory, undoRemoveCategory } from "../actions";

type Category = { id: string; name: string; productCount: number };

/** Categorías del catálogo: agregar, renombrar, ordenar y borrar (con deshacer). */
export function CategoriesManager({
  businessId,
  categories,
}: {
  businessId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = categories.filter((c) => !hidden.includes(c.id));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    startBusy(async () => {
      const res = await saveCategory({ businessId, name: newName });
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      setNewName("");
      router.refresh();
    });
  };

  const rename = () => {
    if (!editing) return;
    startBusy(async () => {
      const res = await saveCategory({ businessId, categoryId: editing.id, name: editing.name });
      if (!res.ok) return void toast.error(res.message);
      setEditing(null);
      router.refresh();
    });
  };

  const remove = (category: Category) => {
    // Fuera de la transición: se oculta al instante, sin esperar al servidor.
    setHidden((h) => [...h, category.id]);
    startBusy(async () => {
      const res = await removeCategory({ businessId, categoryId: category.id });
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== category.id));
        return void toast.error(res.message);
      }
      router.refresh();
      toast(
        category.productCount > 0
          ? `Categoría eliminada. Sus ${category.productCount} productos quedaron sin categoría.`
          : "Categoría eliminada",
        {
          duration: 6000,
          action: {
            label: "Deshacer",
            onClick: async () => {
              const undo = await undoRemoveCategory({ businessId, deleted: res.data.deleted });
              if (undo.ok) {
                setHidden((h) => h.filter((id) => id !== category.id));
                toast.success(undo.message);
                router.refresh();
              } else {
                toast.error(undo.message);
              }
            },
          },
        },
      );
    });
  };

  const move = (categoryId: string, direction: -1 | 1) =>
    startBusy(async () => {
      const res = await moveCategoryAction({ businessId, categoryId, direction });
      if (!res.ok) toast.error(res.message);
      router.refresh();
    });

  return (
    <div className="grid gap-5">
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="new-category" className="sr-only">
          Nueva categoría
        </label>
        <Input
          id="new-category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ej.: Desayunos, Bebidas frías"
          maxLength={40}
        />
        <Button type="submit" disabled={newName.trim().length < 2 || busy}>
          <PlusIcon />
          Agregar
        </Button>
      </form>

      {visible.length === 0 ? (
        <EmptyState title="Aún no tienes categorías" icon={<PlusIcon />}>
          Agrúpalas como en tu menú impreso: Desayunos, Almuerzos, Bebidas, Postres.
        </EmptyState>
      ) : (
        <ul className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-1">
          {visible.map((category, index) => (
            <li key={category.id} className="flex items-center gap-2 p-3 sm:p-4">
              {editing?.id === category.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename();
                  }}
                >
                  <Input
                    autoFocus
                    aria-label="Nombre de la categoría"
                    value={editing.name}
                    maxLength={40}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <Button type="submit" size="icon" aria-label="Guardar nombre" loading={busy}>
                    <CheckIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Cancelar"
                    onClick={() => setEditing(null)}
                  >
                    <XIcon />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="grid min-w-0 flex-1">
                    <span className="type-body truncate font-semibold">{category.name}</span>
                    <span className="type-caption text-muted-foreground">
                      {category.productCount === 1
                        ? "1 producto"
                        : `${category.productCount} productos`}
                    </span>
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Subir ${category.name}`}
                    disabled={index === 0 || busy}
                    onClick={() => move(category.id, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Bajar ${category.name}`}
                    disabled={index === visible.length - 1 || busy}
                    onClick={() => move(category.id, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Renombrar ${category.name}`}
                    onClick={() => setEditing({ id: category.id, name: category.name })}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar ${category.name}`}
                    className="text-destructive"
                    onClick={() => remove(category)}
                  >
                    <Trash2Icon />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
