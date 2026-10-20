"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  moveBankAccountAction,
  removeBankAccount,
  saveBankAccount,
  toggleBankAccount,
  undoRemoveBankAccount,
} from "../actions";
import {
  ACCOUNT_TYPES,
  ALL_BRANCHES,
  bankAccountSchema,
  GT_BANKS,
  type BankAccountInput,
  type BankAccountOutput,
} from "../schemas";
import type { BankAccountRow } from "../server";
import { BankAccountCard } from "./bank-account-card";

type Branch = { id: string; name: string };

export function BankAccountsManager({
  businessId,
  accounts,
  branches,
}: {
  businessId: string;
  accounts: BankAccountRow[];
  branches: Branch[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, startBusy] = useTransition();
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "Sucursal") : "Todas las sucursales";
  const visible = accounts.filter((a) => !hidden.includes(a.id));

  const remove = (account: BankAccountRow) =>
    startBusy(async () => {
      setHidden((h) => [...h, account.id]);
      const res = await removeBankAccount({ businessId, accountId: account.id });
      if (!res.ok) {
        setHidden((h) => h.filter((id) => id !== account.id));
        toast.error(res.message);
        return;
      }
      router.refresh();
      // Deshacer en vez de confirmar (6 s), como pide la guía.
      toast("Cuenta eliminada", {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await undoRemoveBankAccount({ businessId, account: res.data.account });
            if (undo.ok) {
              setHidden((h) => h.filter((id) => id !== account.id));
              toast.success(undo.message);
              router.refresh();
            } else {
              toast.error(undo.message);
            }
          },
        },
      });
    });

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startBusy(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message ?? "No pudimos guardar el cambio.");
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      {editing === "new" ? (
        <AccountForm
          businessId={businessId}
          branches={branches}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button className="justify-self-start" onClick={() => setEditing("new")}>
          <PlusIcon />
          Agregar cuenta
        </Button>
      )}

      {visible.length === 0 && editing !== "new" ? (
        <EmptyState title="Aún no tienes cuentas" icon={<PlusIcon />}>
          Agrega tu cuenta bancaria para que tus clientes te transfieran fácil al pedir.
        </EmptyState>
      ) : null}

      <ul className="grid gap-4">
        {visible.map((account, i) =>
          editing === account.id ? (
            <li key={account.id}>
              <AccountForm
                businessId={businessId}
                branches={branches}
                account={account}
                onDone={() => {
                  setEditing(null);
                  router.refresh();
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={account.id}
              className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-1 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="type-caption rounded-full bg-nube px-2.5 py-1 font-semibold">
                  {branchName(account.branch_id)}
                </span>
                <label className="flex items-center gap-2">
                  <span className="type-small text-muted-foreground">
                    {account.is_active ? "Visible para tus clientes" : "Oculta"}
                  </span>
                  <Switch
                    checked={account.is_active}
                    disabled={busy}
                    aria-label="Mostrar esta cuenta a los clientes"
                    onCheckedChange={(isActive) =>
                      run(() => toggleBankAccount({ businessId, accountId: account.id, isActive }))
                    }
                  />
                </label>
              </div>
              <BankAccountCard
                account={account}
                className={account.is_active ? "" : "opacity-60"}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(account.id)}>
                  <PencilIcon />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Subir"
                  disabled={busy || i === 0}
                  onClick={() =>
                    run(() =>
                      moveBankAccountAction({ businessId, accountId: account.id, direction: -1 }),
                    )
                  }
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Bajar"
                  disabled={busy || i === visible.length - 1}
                  onClick={() =>
                    run(() =>
                      moveBankAccountAction({ businessId, accountId: account.id, direction: 1 }),
                    )
                  }
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  disabled={busy}
                  onClick={() => remove(account)}
                >
                  <Trash2Icon />
                  Eliminar
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function AccountForm({
  businessId,
  branches,
  account,
  onDone,
  onCancel,
}: {
  businessId: string;
  branches: Branch[];
  account?: BankAccountRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const form = useForm<BankAccountInput, unknown, BankAccountOutput>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      businessId,
      accountId: account?.id,
      bank_name: account?.bank_name ?? "",
      account_type: (account?.account_type as BankAccountInput["account_type"]) ?? "Monetaria",
      account_number: account?.account_number ?? "",
      holder_name: account?.holder_name ?? "",
      instructions: account?.instructions ?? "",
      branchId: account?.branch_id ?? ALL_BRANCHES,
      is_active: account?.is_active ?? true,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() =>
    startSave(async () => {
      setError(null);
      const res = await saveBankAccount(form.getValues());
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(res.message ?? "¡Listo!");
      onDone();
    }),
  );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-4 rounded-xl border border-primary/40 bg-card p-5 shadow-2 sm:p-6"
    >
      <h2 className="type-h3">{account ? "Editar cuenta" : "Nueva cuenta"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="bank_name" label="Banco" error={errors.bank_name?.message}>
          <Input
            id="bank_name"
            list="gt-banks"
            autoComplete="off"
            aria-invalid={!!errors.bank_name}
            {...form.register("bank_name")}
          />
          <datalist id="gt-banks">
            {GT_BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field id="account_type" label="Tipo de cuenta" error={errors.account_type?.message}>
          <Controller
            control={form.control}
            name="account_type"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label="Tipo de cuenta"
                className="grid h-12 grid-cols-2 rounded-md bg-muted p-1"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={field.value === t}
                    onClick={() => field.onChange(t)}
                    className="type-small rounded-sm font-semibold text-muted-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-1"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>
        <Field id="account_number" label="Número de cuenta" error={errors.account_number?.message}>
          <Input
            id="account_number"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={!!errors.account_number}
            {...form.register("account_number")}
          />
        </Field>
        <Field id="holder_name" label="A nombre de" error={errors.holder_name?.message}>
          <Input
            id="holder_name"
            aria-invalid={!!errors.holder_name}
            {...form.register("holder_name")}
          />
        </Field>
      </div>
      <Field id="branchId" label="Se muestra en" hint="Una cuenta por sucursal o una para todas.">
        <select
          id="branchId"
          className="h-12 w-full rounded-md border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          {...form.register("branchId")}
        >
          <option value={ALL_BRANCHES}>Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              Solo {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="instructions"
        label="Instrucciones (opcional)"
        error={errors.instructions?.message}
        hint="Por ejemplo: envía tu comprobante por WhatsApp con tu número de pedido."
      >
        <Input id="instructions" {...form.register("instructions")} />
      </Field>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {account ? "Guardar cuenta" : "Agregar cuenta"}
        </Button>
      </div>
    </form>
  );
}
