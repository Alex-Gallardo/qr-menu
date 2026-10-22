"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  GripVerticalIcon,
  ImageIcon,
  PlusIcon,
  StarIcon,
  TextIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { SaveIndicator } from "@/components/feedback/save-indicator";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatQ, parseQ } from "@/lib/money";
import { useAutosave } from "@/lib/use-autosave";
import { saveMenu } from "../actions";
import { menuDocumentSchema } from "../schemas";
import type { PickerProduct } from "../server";
import {
  addProducts,
  duplicateSection,
  emptySection,
  MENU_TEMPLATES,
  menuStats,
  moveItemToSection,
  statsLabel,
  type DraftItem,
  type DraftSection,
  type MenuTemplate,
} from "../structure";
import { ProductPicker } from "./product-picker";

export type EditorDoc = {
  name: string;
  description: string;
  template: MenuTemplate;
  sections: DraftSection[];
};

/** Nombres frecuentes para armar el menú en segundos. */
const SECTION_SUGGESTIONS = [
  "Entradas",
  "Platos fuertes",
  "Bebidas",
  "Postres",
  "Desayunos",
  "Acompañamientos",
];

const selectClass =
  "h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * Editor del menú: secciones y productos que se arrastran para ordenar, precio
 * especial por menú y destacado. Se guarda solo (Guardando… → Guardado).
 */
export function MenuEditor({
  businessId,
  menuId,
  initial,
  products,
  allowedTemplates,
}: {
  businessId: string;
  menuId: string;
  initial: EditorDoc;
  products: PickerProduct[];
  allowedTemplates: MenuTemplate[];
}) {
  const [doc, setDoc] = useState(initial);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const save = useCallback(
    async (value: EditorDoc) => {
      // Se valida aquí para avisar sin ir al servidor, pero se envían los valores
      // crudos: la Server Action vuelve a validar con el mismo esquema.
      const input = { ...value, businessId, menuId };
      const parsed = menuDocumentSchema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
      }
      return saveMenu(input);
    },
    [businessId, menuId],
  );
  const autosave = useAutosave(doc, save);

  const update = (patch: Partial<EditorDoc>) => setDoc((d) => ({ ...d, ...patch }));
  const setSections = (fn: (sections: DraftSection[]) => DraftSection[]) =>
    setDoc((d) => ({ ...d, sections: fn(d.sections) }));
  const updateSection = (key: string, fn: (s: DraftSection) => DraftSection) =>
    setSections((ss) => ss.map((s) => (s.key === key ? fn(s) : s)));

  const addSection = (name = "") => {
    const section = emptySection(name);
    setSections((ss) => [...ss, section]);
    // Con nombre sugerido, abre de una vez el selector de productos.
    if (name) setPickerFor(section.key);
    else
      requestAnimationFrame(() => document.getElementById(`section-name-${section.key}`)?.focus());
  };

  const removeSection = (key: string) => {
    const index = doc.sections.findIndex((s) => s.key === key);
    const removed = doc.sections[index];
    if (!removed) return;
    setSections((ss) => ss.filter((s) => s.key !== key));
    toast(`Sección “${removed.name || "sin nombre"}” eliminada`, {
      duration: 6000,
      action: {
        label: "Deshacer",
        onClick: () =>
          setSections((ss) =>
            ss.some((s) => s.key === key)
              ? ss
              : [...ss.slice(0, index), removed, ...ss.slice(index)],
          ),
      },
    });
  };

  // id estable: sin él, dnd-kit numera "DndDescribedBy-N" distinto en servidor y navegador.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionLabel = (id: string | number) =>
    doc.sections.find((s) => s.key === id)?.name || "Sección sin nombre";

  const onSectionsDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setSections((ss) => {
      const from = ss.findIndex((s) => s.key === active.id);
      const to = ss.findIndex((s) => s.key === over.id);
      return from < 0 || to < 0 ? ss : arrayMove(ss, from, to);
    });
  };

  const stats = menuStats(doc.sections);
  const usedNames = new Set(doc.sections.map((s) => s.name.trim().toLowerCase()));
  const suggestions = SECTION_SUGGESTIONS.filter((n) => !usedNames.has(n.toLowerCase())).slice(
    0,
    4,
  );
  const pickerSection = doc.sections.find((s) => s.key === pickerFor);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="type-small text-muted-foreground">{statsLabel(stats)}</p>
          <SaveIndicator state={autosave.state} onRetry={autosave.retry} />
        </div>
        {autosave.state === "error" && autosave.error ? (
          <FormMessage tone="error">{autosave.error}</FormMessage>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="menu-name" label="Nombre del menú">
            <Input
              id="menu-name"
              value={doc.name}
              maxLength={60}
              onChange={(e) => update({ name: e.target.value })}
            />
          </Field>
          <Field id="menu-template" label="Plantilla" hint="Cómo se ve en el celular del cliente.">
            <select
              id="menu-template"
              className={selectClass}
              value={doc.template}
              onChange={(e) => update({ template: e.target.value as MenuTemplate })}
            >
              {MENU_TEMPLATES.map((t) => (
                <option
                  key={t.value}
                  value={t.value}
                  disabled={!allowedTemplates.includes(t.value)}
                >
                  {t.label}
                  {allowedTemplates.includes(t.value) ? "" : " (planes Pro y Negocio)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          id="menu-description"
          label="Descripción (opcional)"
          hint="Ej.: “Lunes a viernes de 11:30 a 15:30”."
        >
          <Input
            id="menu-description"
            value={doc.description}
            maxLength={160}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>
      </section>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onSectionsDragEnd}
        accessibility={{
          announcements: announcements(sectionLabel, "La sección"),
          screenReaderInstructions,
        }}
      >
        <SortableContext
          items={doc.sections.map((s) => s.key)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="grid gap-4">
            {doc.sections.map((section, index) => (
              <SectionCard
                key={section.key}
                section={section}
                position={index + 1}
                total={doc.sections.length}
                otherSections={doc.sections.filter((s) => s.key !== section.key)}
                productById={productById}
                onChange={(fn) => updateSection(section.key, fn)}
                onMoveSection={(direction) =>
                  setSections((ss) => {
                    const to = index + direction;
                    return to < 0 || to >= ss.length ? ss : arrayMove(ss, index, to);
                  })
                }
                onDuplicate={() => setSections((ss) => duplicateSection(ss, section.key))}
                onRemove={() => removeSection(section.key)}
                onMoveItem={(itemKey, target) =>
                  setSections((ss) => moveItemToSection(ss, itemKey, target))
                }
                onAddProducts={() => setPickerFor(section.key)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="grid gap-3 rounded-xl border border-dashed border-border p-4">
        <Button variant="outline" className="justify-self-start" onClick={() => addSection()}>
          <PlusIcon />
          Agregar sección
        </Button>
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-small text-muted-foreground">Rápido:</span>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addSection(name)}
                className="type-small h-10 rounded-full border border-border bg-card px-4 font-semibold hover:bg-muted"
              >
                + {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {pickerSection ? (
        <ProductPicker
          sectionName={pickerSection.name}
          products={products}
          alreadyIn={new Set(pickerSection.items.map((i) => i.productId))}
          onClose={() => setPickerFor(null)}
          onAdd={(ids) => {
            updateSection(pickerSection.key, (s) => addProducts(s, ids));
            setPickerFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SectionCard({
  section,
  position,
  total,
  otherSections,
  productById,
  onChange,
  onMoveSection,
  onDuplicate,
  onRemove,
  onMoveItem,
  onAddProducts,
}: {
  section: DraftSection;
  position: number;
  total: number;
  otherSections: DraftSection[];
  productById: Map<string, PickerProduct>;
  onChange: (fn: (s: DraftSection) => DraftSection) => void;
  /** Alternativa a arrastrar (funciona en cualquier pantalla y con lector de pantalla). */
  onMoveSection: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveItem: (itemKey: string, targetSectionKey: string) => void;
  onAddProducts: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.key });
  const [showDescription, setShowDescription] = useState(section.description !== "");
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const label = section.name || `Sección ${position}`;
  const itemLabel = (id: string | number) => {
    const item = section.items.find((i) => i.key === id);
    return (item && productById.get(item.productId)?.name) || "Producto";
  };

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    onChange((s) => ({
      ...s,
      items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    }));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "grid gap-3 rounded-xl border border-border bg-card p-3 shadow-1 sm:p-4",
        isDragging && "relative z-10 shadow-3 ring-2 ring-ring/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover ${label}`}
          className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-5" />
        </button>
        <Input
          id={`section-name-${section.key}`}
          value={section.name}
          maxLength={60}
          placeholder="Nombre de la sección"
          aria-label={`Nombre de la sección ${position}`}
          aria-invalid={section.name.trim() === ""}
          className="type-h3 h-11 border-transparent bg-transparent px-2 hover:border-input focus-visible:bg-card"
          onChange={(e) => onChange((s) => ({ ...s, name: e.target.value }))}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${label}`}>
              <EllipsisVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {!showDescription ? (
              <DropdownMenuItem className="min-h-11" onSelect={() => setShowDescription(true)}>
                <TextIcon />
                Agregar descripción
              </DropdownMenuItem>
            ) : null}
            {position > 1 ? (
              <DropdownMenuItem className="min-h-11" onSelect={() => onMoveSection(-1)}>
                <ArrowUpIcon />
                Subir sección
              </DropdownMenuItem>
            ) : null}
            {position < total ? (
              <DropdownMenuItem className="min-h-11" onSelect={() => onMoveSection(1)}>
                <ArrowDownIcon />
                Bajar sección
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem className="min-h-11" onSelect={onDuplicate}>
              <CopyIcon />
              Duplicar sección
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="min-h-11" onSelect={onRemove}>
              <Trash2Icon />
              Eliminar sección
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showDescription ? (
        <Input
          value={section.description}
          maxLength={160}
          placeholder="Descripción de la sección (opcional)"
          aria-label={`Descripción de ${label}`}
          onChange={(e) => onChange((s) => ({ ...s, description: e.target.value }))}
        />
      ) : null}

      {section.items.length === 0 ? (
        <p className="type-small rounded-md bg-muted/60 px-3 py-4 text-center text-muted-foreground">
          Sin productos todavía.
        </p>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          accessibility={{
            announcements: announcements(itemLabel, "El producto"),
            screenReaderInstructions,
          }}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            onChange((s) => {
              const from = s.items.findIndex((i) => i.key === active.id);
              const to = s.items.findIndex((i) => i.key === over.id);
              return from < 0 || to < 0 ? s : { ...s, items: arrayMove(s.items, from, to) };
            });
          }}
        >
          <SortableContext
            items={section.items.map((i) => i.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="grid divide-y divide-border rounded-lg border border-border">
              {section.items.map((item, index) => (
                <ItemRow
                  key={item.key}
                  item={item}
                  product={productById.get(item.productId)}
                  otherSections={otherSections}
                  canMoveUp={index > 0}
                  canMoveDown={index < section.items.length - 1}
                  onReorder={(direction) =>
                    onChange((s) => {
                      const to = index + direction;
                      return to < 0 || to >= s.items.length
                        ? s
                        : { ...s, items: arrayMove(s.items, index, to) };
                    })
                  }
                  onChange={(patch) => setItem(item.key, patch)}
                  onRemove={() =>
                    onChange((s) => ({ ...s, items: s.items.filter((i) => i.key !== item.key) }))
                  }
                  onMove={(target) => onMoveItem(item.key, target)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Button variant="ghost" size="sm" className="justify-self-start" onClick={onAddProducts}>
        <PlusIcon />
        Agregar productos
      </Button>
    </li>
  );
}

function ItemRow({
  item,
  product,
  otherSections,
  canMoveUp,
  canMoveDown,
  onReorder,
  onChange,
  onRemove,
  onMove,
}: {
  item: DraftItem;
  product: PickerProduct | undefined;
  otherSections: DraftSection[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onReorder: (direction: -1 | 1) => void;
  onChange: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  onMove: (targetSectionKey: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });
  const name = product?.name ?? "Producto";
  const priceInvalid = item.price.trim() !== "" && parseQ(item.price) === null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-2 bg-card p-2", isDragging && "relative z-10 shadow-2")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${name}`}
        className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="hidden aspect-[4/3] w-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-muted text-muted-foreground sm:grid">
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-4" />
        )}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="type-small truncate font-semibold">{name}</span>
        {product && !product.is_available ? (
          <span className="type-caption text-destructive">Agotado en el catálogo</span>
        ) : null}
      </span>
      <div className="relative w-24 shrink-0">
        <span className="type-caption pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
          Q
        </span>
        <Input
          inputMode="decimal"
          value={item.price}
          placeholder={product ? formatQ(product.price_cents).slice(1) : ""}
          aria-label={`Precio de ${name} en este menú`}
          aria-invalid={priceInvalid}
          title="Precio especial en este menú (vacío = precio del catálogo)"
          className="h-10 pl-6 text-sm"
          onChange={(e) => onChange({ price: e.target.value })}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-pressed={item.isFeatured}
        aria-label={`Destacar ${name}`}
        className={cn(item.isFeatured ? "text-maiz" : "text-muted-foreground")}
        onClick={() => onChange({ isFeatured: !item.isFeatured })}
      >
        <StarIcon className={cn(item.isFeatured && "fill-current")} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${name}`}>
            <EllipsisVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {canMoveUp ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => onReorder(-1)}>
              <ArrowUpIcon />
              Subir
            </DropdownMenuItem>
          ) : null}
          {canMoveDown ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => onReorder(1)}>
              <ArrowDownIcon />
              Bajar
            </DropdownMenuItem>
          ) : null}
          {canMoveUp || canMoveDown ? <DropdownMenuSeparator /> : null}
          {otherSections.length > 0 ? (
            <>
              <DropdownMenuLabel className="type-caption text-muted-foreground">
                Mover a
              </DropdownMenuLabel>
              {otherSections.map((s) => (
                <DropdownMenuItem key={s.key} className="min-h-11" onSelect={() => onMove(s.key)}>
                  <ArrowRightIcon />
                  {s.name || "Sección sin nombre"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem variant="destructive" className="min-h-11" onSelect={onRemove}>
            <XIcon />
            Quitar del menú
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

const screenReaderInstructions = {
  draggable:
    "Para mover, presiona espacio o Enter. Usa las flechas arriba y abajo, y presiona espacio o Enter para soltar o Escape para cancelar.",
};

/** Mensajes en español para lectores de pantalla al arrastrar. */
function announcements(label: (id: string | number) => string, noun: string): Announcements {
  return {
    onDragStart: ({ active }) => `${noun} ${label(active.id)} se está moviendo.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${noun} ${label(active.id)} está sobre ${label(over.id)}.`
        : `${noun} ${label(active.id)} está fuera de la lista.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${noun} ${label(active.id)} quedó en el lugar de ${label(over.id)}.`
        : `${noun} ${label(active.id)} se soltó.`,
    onDragCancel: ({ active }) => `Se canceló el movimiento de ${label(active.id)}.`,
  };
}
