"use client";

import { CopyIcon, ImageIcon, MinusIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { productsLabel, type PricedLine } from "@/features/cart/cart";
import {
  CHECKOUT_FIELD_ORDER,
  checkoutProblems,
  MAX_ADDRESS,
  MAX_NAME,
  MAX_ORDER_NOTE,
  MAX_TABLE,
  ORDER_TYPE_LABELS,
  orderTotals,
  orderTypes,
  PAY_METHOD_LABELS,
  payMethods,
  defaultOrderType,
  type CheckoutBranch,
  type CheckoutInput,
  type OrderType,
  type PayMethod,
} from "@/features/orders/checkout";
import type { OrderTiming } from "@/features/orders/preorder";
import { formatQ } from "@/lib/money";
import { MAX_QUANTITY } from "../../cart-line";

export type BankAccount = {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  instructions: string | null;
};

export type CheckoutConfig = {
  branch: CheckoutBranch;
  timing: OrderTiming;
  bankAccounts: BankAccount[];
  /** "Mesa 4" si llegó por el QR de una mesa. */
  table: string | null;
  /** Por qué no se puede pedir ahora (sucursal en pausa, cerrada sin programados). */
  blockedReason: string | null;
};

export type RememberedCustomer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  addressReference: string;
  lastOrderType: OrderType | null;
  lastPayment: PayMethod | null;
};

export type OrderSheetProps = {
  branchName: string;
  lines: PricedLine[];
  count: number;
  subtotalCents: number;
  checkout: CheckoutConfig;
  customer: RememberedCustomer;
  onQuantity: (key: string, quantity: number) => void;
  onClear: () => void;
  onClose: () => void;
  onSubmit: (input: CheckoutInput, totals: ReturnType<typeof orderTotals>) => void;
};

const FIELD =
  "type-body w-full rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-bg)] px-3 py-2.5 outline-none placeholder:text-[var(--menu-muted)] focus-visible:border-[var(--menu-primary)] focus-visible:ring-3 focus-visible:ring-[var(--menu-primary)]/25 aria-invalid:border-destructive";

/**
 * Hoja de pedido (plantilla Clásico): lista editable, cómo lo quiere (con la
 * mesa del QR ya puesta), ¿para cuándo?, sus datos recordados, el pago con
 * las cuentas para transferencia y "Pedir por WhatsApp". Se carga bajo demanda.
 */
export function OrderSheet({
  branchName,
  lines,
  count,
  subtotalCents,
  checkout,
  customer,
  onQuantity,
  onClear,
  onClose,
  onSubmit,
}: OrderSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const types = orderTypes(checkout.branch);
  const pays = payMethods(checkout.branch);
  const { timing } = checkout;

  const [form, setForm] = useState<CheckoutInput>(() => ({
    orderType: defaultOrderType(types, { table: checkout.table, last: customer.lastOrderType }),
    table: checkout.table ?? "",
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    addressReference: customer.addressReference,
    // Cerrada (para cuando abra): el primer horario disponible.
    scheduledFor: timing.asap ? null : (timing.days[0]?.times[0]?.at ?? null),
    payment:
      customer.lastPayment && pays.includes(customer.lastPayment) ? customer.lastPayment : null,
    note: "",
  }));
  const [showProblems, setShowProblems] = useState(false);
  const set = <K extends keyof CheckoutInput>(key: K, value: CheckoutInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", ""); // jsdom
  }, []);

  const totals = orderTotals(subtotalCents, form.orderType, checkout.branch);
  const validTimes = timing.days.flatMap((d) => d.times.map((t) => t.at));
  const problems = checkoutProblems(form, {
    branch: checkout.branch,
    subtotalCents,
    asap: timing.asap,
    validTimes,
  });
  const shown = showProblems ? problems : {};
  const hasIssues = lines.some((l) => l.issue);

  function submit() {
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      const first = CHECKOUT_FIELD_ORDER.find((f) => problems[f]);
      const el = ref.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      el?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({
        preventScroll: true,
      });
      return;
    }
    onSubmit(form, totals);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="pedido-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="product-sheet animate-subir mx-auto mt-auto mb-0 flex max-h-[94dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[calc(var(--menu-radius)*1.25)] border-0 bg-[var(--menu-surface)] p-0 text-[var(--menu-text)] shadow-3 backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-center gap-3 border-b border-[var(--menu-line)] py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h2 id="pedido-titulo" className="type-h3">
            Tu pedido
          </h2>
          <p className="type-small text-[var(--menu-muted)]">
            {branchName}
            {form.orderType ? ` · ${ORDER_TYPE_LABELS[form.orderType]}` : ""}
            {form.orderType === "dine_in" && form.table.trim() ? ` · ${form.table.trim()}` : ""}
          </p>
        </div>
        {lines.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="type-small h-10 rounded-full px-3 font-semibold text-[var(--menu-muted)] hover:bg-[var(--menu-soft)]"
          >
            Vaciar
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-11 place-items-center rounded-full hover:bg-[var(--menu-soft)]"
        >
          <XIcon aria-hidden className="size-5" />
        </button>
      </header>

      {lines.length === 0 ? (
        <div className="grid justify-items-center gap-3 px-4 py-10 text-center">
          <p className="type-body text-[var(--menu-muted)]">Tu pedido está vacío.</p>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-full bg-[var(--menu-primary)] px-6 font-semibold text-[var(--menu-on-primary)]"
          >
            Ver el menú
          </button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="px-4" data-field="total">
              {lines.map((line) => (
                <CartLineRow key={line.key} line={line} onQuantity={onQuantity} />
              ))}
            </ul>

            <div className="grid gap-6 px-4 pt-2 pb-6">
              {types.length > 1 ? (
                <Fieldset legend="¿Cómo lo quieres?" field="orderType" problem={shown.orderType}>
                  <Choices
                    name="tipo"
                    options={types.map((t) => ({ value: t, label: ORDER_TYPE_LABELS[t] }))}
                    value={form.orderType}
                    onChange={(v) => set("orderType", v)}
                  />
                </Fieldset>
              ) : null}

              {form.orderType === "dine_in" ? (
                <Field label="Mesa" optional field="table" problem={shown.table}>
                  <input
                    aria-invalid={shown.table ? true : undefined}
                    value={form.table}
                    onChange={(e) => set("table", e.target.value.slice(0, MAX_TABLE))}
                    placeholder="Mesa 4"
                    className={FIELD}
                  />
                </Field>
              ) : null}

              {form.orderType === "delivery" ? (
                <section
                  aria-labelledby="donde"
                  className="grid gap-3 rounded-[var(--menu-radius)] bg-[var(--menu-soft)] p-4"
                >
                  <h3 id="donde" className="type-h3">
                    ¿Dónde te lo llevamos?
                  </h3>
                  <Field label="Dirección" field="address" problem={shown.address}>
                    <input
                      aria-invalid={shown.address ? true : undefined}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value.slice(0, MAX_ADDRESS))}
                      autoComplete="street-address"
                      placeholder="4a avenida 12-30, zona 10"
                      className={FIELD}
                    />
                  </Field>
                  <Field label="Punto de referencia" optional field="addressReference">
                    <input
                      value={form.addressReference}
                      onChange={(e) =>
                        set("addressReference", e.target.value.slice(0, MAX_ADDRESS))
                      }
                      placeholder="Portón negro frente a la farmacia"
                      className={FIELD}
                    />
                  </Field>
                  {checkout.branch.deliveryFeeCents > 0 ? (
                    <p className="type-small text-[var(--menu-muted)]">
                      Envío: {formatQ(checkout.branch.deliveryFeeCents)}
                      {checkout.branch.minOrderCents > 0
                        ? ` · pedido mínimo ${formatQ(checkout.branch.minOrderCents)}`
                        : ""}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {timing.days.length > 0 ? (
                <WhenField
                  timing={timing}
                  value={form.scheduledFor}
                  onChange={(v) => set("scheduledFor", v)}
                  problem={shown.scheduledFor}
                />
              ) : null}

              <fieldset className="grid gap-3">
                <legend className="type-h3 mb-3">Tus datos</legend>
                <Field label="Nombre" field="name" problem={shown.name}>
                  <input
                    aria-invalid={shown.name ? true : undefined}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value.slice(0, MAX_NAME))}
                    autoComplete="name"
                    placeholder="María López"
                    className={FIELD}
                  />
                </Field>
                <Field
                  label="Teléfono"
                  optional={form.orderType !== "delivery"}
                  field="phone"
                  problem={shown.phone}
                >
                  <input
                    aria-invalid={shown.phone ? true : undefined}
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value.slice(0, 20))}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="5555-1234"
                    className={FIELD}
                  />
                </Field>
                <Field
                  label="¿Quieres el resumen por correo?"
                  optional
                  field="email"
                  problem={shown.email}
                >
                  <input
                    aria-invalid={shown.email ? true : undefined}
                    value={form.email}
                    onChange={(e) => set("email", e.target.value.slice(0, 120))}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="maria@correo.com"
                    className={FIELD}
                  />
                </Field>
                <p className="type-caption text-[var(--menu-muted)]">
                  Guardamos tus datos solo en este teléfono para tu próximo pedido.
                </p>
              </fieldset>

              <Fieldset legend="¿Cómo vas a pagar?" field="payment" problem={shown.payment}>
                <Choices
                  name="pago"
                  options={pays.map((p) => ({
                    value: p,
                    label: PAY_METHOD_LABELS[p],
                    hint: p === "card_on_site" ? "Al recibir o en el local" : undefined,
                  }))}
                  value={form.payment}
                  onChange={(v) => set("payment", v)}
                />
                {form.payment === "transfer" ? (
                  <BankAccounts accounts={checkout.bankAccounts} totalCents={totals.totalCents} />
                ) : null}
              </Fieldset>

              <Field label="Nota para la sucursal" optional field="note" problem={shown.note}>
                <textarea
                  aria-invalid={shown.note ? true : undefined}
                  value={form.note}
                  onChange={(e) => set("note", e.target.value.slice(0, MAX_ORDER_NOTE))}
                  rows={2}
                  placeholder="Sin cebolla, por favor"
                  className={cn(FIELD, "resize-none")}
                />
              </Field>

              <dl className="type-body grid gap-1">
                <div className="flex justify-between">
                  <dt>Subtotal · {productsLabel(count)}</dt>
                  <dd className="tabular-nums">{formatQ(totals.subtotalCents)}</dd>
                </div>
                {totals.deliveryFeeCents > 0 ? (
                  <div className="flex justify-between">
                    <dt>Envío</dt>
                    <dd className="tabular-nums">{formatQ(totals.deliveryFeeCents)}</dd>
                  </div>
                ) : null}
                <div className="type-h3 flex justify-between">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatQ(totals.totalCents)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <footer className="grid gap-2 border-t border-[var(--menu-line)] bg-[var(--menu-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {checkout.blockedReason ? (
              <p role="status" className="type-small text-center text-[var(--menu-muted)]">
                {checkout.blockedReason}
              </p>
            ) : shown.total ? (
              <p role="alert" className="type-small text-center font-semibold text-destructive">
                {shown.total}
              </p>
            ) : hasIssues ? (
              <p className="type-small text-center text-[var(--menu-muted)]">
                Lo que se acabó no se incluye en tu pedido.
              </p>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={checkout.blockedReason !== null}
              className="type-body flex h-14 items-center justify-center gap-2 rounded-full bg-whatsapp px-4 font-semibold text-frijol transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              <WhatsAppGlyph />
              Pedir por WhatsApp ·{" "}
              <span className="tabular-nums">{formatQ(totals.totalCents)}</span>
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}

function CartLineRow({
  line,
  onQuantity,
}: {
  line: PricedLine;
  onQuantity: (key: string, quantity: number) => void;
}) {
  return (
    <li className="flex gap-3 border-b border-[var(--menu-line)] py-3">
      <span
        className={cn(
          "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[calc(var(--menu-radius)*0.6)] bg-[var(--menu-soft)] text-[var(--menu-muted)]",
          line.issue && "grayscale",
        )}
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <ImageIcon aria-hidden className="size-5" />
        )}
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="type-body flex items-start justify-between gap-2 font-semibold">
          <span className={cn(line.issue && "opacity-60")}>{line.name}</span>
          {line.issue ? null : (
            <span className="type-price shrink-0">{formatQ(line.lineCents)}</span>
          )}
        </p>
        {line.optionNames.length > 0 ? (
          <p className="type-small text-[var(--menu-muted)]">{line.optionNames.join(", ")}</p>
        ) : null}
        {line.note ? (
          <p className="type-small text-[var(--menu-muted)] italic">“{line.note}”</p>
        ) : null}
        {line.issue ? (
          <p className="type-small flex items-center justify-between gap-2 font-semibold text-destructive">
            {line.issue}
            <button
              type="button"
              onClick={() => onQuantity(line.key, 0)}
              className="h-10 shrink-0 rounded-full px-3 text-[var(--menu-text)] underline underline-offset-4"
            >
              Quitar
            </button>
          </p>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="type-small text-[var(--menu-muted)] tabular-nums">
              {formatQ(line.unitCents)} c/u
            </span>
            <div
              role="group"
              aria-label={`Cantidad de ${line.name}`}
              className="flex items-center rounded-full border border-[var(--menu-line)]"
            >
              <button
                type="button"
                aria-label={line.quantity === 1 ? `Quitar ${line.name}` : "Quitar uno"}
                onClick={() => onQuantity(line.key, line.quantity - 1)}
                className="grid size-10 place-items-center rounded-full"
              >
                {line.quantity === 1 ? (
                  <Trash2Icon aria-hidden className="size-4" />
                ) : (
                  <MinusIcon aria-hidden className="size-4" />
                )}
              </button>
              <output aria-live="polite" className="type-price w-6 text-center">
                {line.quantity}
              </output>
              <button
                type="button"
                aria-label="Agregar uno"
                disabled={line.quantity >= MAX_QUANTITY}
                onClick={() => onQuantity(line.key, line.quantity + 1)}
                className="grid size-10 place-items-center rounded-full disabled:opacity-40"
              >
                <PlusIcon aria-hidden className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function Field({
  label,
  optional = false,
  field,
  problem,
  children,
}: {
  label: string;
  optional?: boolean;
  field: string;
  problem?: string;
  children: ReactNode;
}) {
  return (
    <label data-field={field} className="grid gap-1.5">
      <span className="type-small font-semibold">
        {label}{" "}
        {optional ? <span className="font-normal text-[var(--menu-muted)]">(opcional)</span> : null}
      </span>
      {children}
      {problem ? (
        <span role="alert" className="type-small font-semibold text-destructive">
          {problem}
        </span>
      ) : null}
    </label>
  );
}

function Fieldset({
  legend,
  field,
  problem,
  children,
}: {
  legend: string;
  field: string;
  problem?: string;
  children: ReactNode;
}) {
  return (
    <fieldset data-field={field} className="grid min-w-0 gap-2">
      <legend className="type-h3 mb-2">{legend}</legend>
      {problem ? (
        <p role="alert" className="type-small font-semibold text-destructive">
          {problem}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

/** Tarjetas de opción (radio): grandes y fáciles de tocar. */
function Choices<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex min-h-12 cursor-pointer flex-col justify-center rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-bg)] px-3 py-2 has-checked:border-[var(--menu-primary)] has-checked:bg-[var(--menu-soft)] has-checked:ring-2 has-checked:ring-[var(--menu-primary)] has-focus-visible:ring-3 has-focus-visible:ring-[var(--menu-primary)]/40"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          <span className="type-small font-semibold">{o.label}</span>
          {o.hint ? <span className="type-caption text-[var(--menu-muted)]">{o.hint}</span> : null}
        </label>
      ))}
    </div>
  );
}

function WhenField({
  timing,
  value,
  onChange,
  problem,
}: {
  timing: OrderTiming;
  value: string | null;
  onChange: (value: string | null) => void;
  problem?: string;
}) {
  const selectedDay =
    timing.days.find((d) => d.times.some((t) => t.at === value)) ?? timing.days[0]!;
  return (
    <Fieldset legend="¿Para cuándo?" field="scheduledFor" problem={problem}>
      {timing.asap ? (
        <Choices
          name="cuando"
          options={[
            { value: "asap", label: "Lo antes posible" },
            { value: "programar", label: "Programar" },
          ]}
          value={value === null ? "asap" : "programar"}
          onChange={(v) => onChange(v === "asap" ? null : selectedDay.times[0]!.at)}
        />
      ) : null}
      {value !== null || !timing.asap ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="type-caption text-[var(--menu-muted)]">Día</span>
            <select
              value={selectedDay.date}
              onChange={(e) =>
                onChange(timing.days.find((d) => d.date === e.target.value)!.times[0]!.at)
              }
              className={FIELD}
            >
              {timing.days.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="type-caption text-[var(--menu-muted)]">Hora</span>
            <select
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              className={FIELD}
            >
              {value === null ? <option value="">Elige</option> : null}
              {selectedDay.times.map((t) => (
                <option key={t.at} value={t.at}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </Fieldset>
  );
}

function BankAccounts({ accounts, totalCents }: { accounts: BankAccount[]; totalCents: number }) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Número de cuenta copiado");
    } catch {
      toast("No se pudo copiar; mantén presionado el número para copiarlo.");
    }
  }
  return (
    <div className="grid gap-2">
      <p className="type-small text-[var(--menu-muted)]">
        Transfiere {formatQ(totalCents)} y manda la foto de tu boleta en el chat de WhatsApp.
      </p>
      {accounts.map((a) => (
        <div
          key={a.id}
          className="grid gap-1 rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-bg)] p-3"
        >
          <p className="type-small font-semibold">
            {a.bankName} · {a.accountType}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="type-body font-semibold tabular-nums select-all">
              {a.accountNumber}
            </span>
            <button
              type="button"
              onClick={() => void copy(a.accountNumber)}
              className="type-small inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--menu-line)] px-3 font-semibold"
            >
              <CopyIcon aria-hidden className="size-4" />
              Copiar
            </button>
          </div>
          <p className="type-small text-[var(--menu-muted)]">A nombre de {a.holderName}</p>
          {a.instructions ? <p className="type-small">{a.instructions}</p> : null}
        </div>
      ))}
    </div>
  );
}

function WhatsAppGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
