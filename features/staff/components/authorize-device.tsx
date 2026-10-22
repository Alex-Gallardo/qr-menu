"use client";

import { TabletSmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { withLoading } from "@/lib/loading/store";
import { authorizeDeviceAction } from "../actions";

type Option = {
  businessId: string;
  businessName: string;
  branches: { id: string; name: string }[];
};

const SELECT =
  "h-12 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Paso 1 en la tablet de la sucursal: el dueño o encargado, con su sesión,
 * la autoriza. Después su sesión se cierra en ese dispositivo y aparece el
 * teclado de PIN.
 */
export function AuthorizeDevice({ options }: { options: Option[] }) {
  const router = useRouter();
  const [businessId, setBusinessId] = useState(options[0]?.businessId ?? "");
  const business = options.find((o) => o.businessId === businessId);
  const [branchId, setBranchId] = useState(business?.branches[0]?.id ?? "");
  const [name, setName] = useState("Tablet de caja");
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    setError(null);
    try {
      const result = await withLoading("Autorizando este dispositivo…", () =>
        authorizeDeviceAction({ businessId, branchId, name }),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    } catch (e) {
      if (!(e instanceof LoadingCancelledError)) throw e;
    }
  }

  if (options.length === 0)
    return (
      <p className="type-body text-center text-muted-foreground">
        Tu cuenta no tiene sucursales para autorizar dispositivos.
      </p>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void authorize();
      }}
      className="grid w-full max-w-sm gap-4 rounded-xl border border-border bg-card p-6 shadow-2"
    >
      <span className="grid size-12 place-items-center rounded-full bg-secondary">
        <TabletSmartphoneIcon aria-hidden />
      </span>
      <div>
        <h1 className="type-h2">Autorizar este dispositivo</h1>
        <p className="type-small mt-1 text-muted-foreground">
          Úsalo en la tablet o el celular de la sucursal. Después tu equipo entra aquí con su PIN y
          solo ve los pedidos de esa sucursal.
        </p>
      </div>
      {options.length > 1 ? (
        <div className="grid gap-1.5">
          <Label htmlFor="negocio">Negocio</Label>
          <select
            id="negocio"
            value={businessId}
            onChange={(e) => {
              setBusinessId(e.target.value);
              setBranchId(
                options.find((o) => o.businessId === e.target.value)?.branches[0]?.id ?? "",
              );
            }}
            className={SELECT}
          >
            {options.map((o) => (
              <option key={o.businessId} value={o.businessId}>
                {o.businessName}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="sucursal">Sucursal</Label>
        <select
          id="sucursal"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={SELECT}
        >
          {business?.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nombre">Nombre del dispositivo</Label>
        <Input id="nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </div>
      {error ? (
        <p role="alert" className="type-small font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg">
        Autorizar este dispositivo
      </Button>
      <p className="type-caption text-muted-foreground">
        Al autorizarlo se cierra tu sesión en este dispositivo para que nadie use tu cuenta.
      </p>
    </form>
  );
}
