"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useCart } from "@/features/cart/store";

/**
 * Carrito de esta sucursal. Al montar se lee lo guardado en el dispositivo y
 * se "entra" a la sucursal: si el carrito era de otra, se vacía con un aviso
 * y la opción de volver a ella con su pedido.
 */
export function useBranchCart(
  business: { id: string; slug: string },
  branch: { id: string; slug: string; name: string },
) {
  const router = useRouter();
  const cart = useCart((s) => s.carts[business.id]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useCart.persist.rehydrate()).then(() => {
      if (cancelled) return;
      const replaced = useCart.getState().enter(business.id, {
        branchId: branch.id,
        branchSlug: branch.slug,
        branchName: branch.name,
      });
      if (!replaced) return;
      toast(`Vaciamos tu pedido de ${replaced.branchName}`, {
        description: "Cada sucursal tiene sus propios platillos y precios.",
        duration: 8000,
        action: {
          label: `Volver a ${replaced.branchName}`,
          onClick: () => {
            useCart.getState().restore(business.id, replaced);
            router.push(`/${business.slug}/${replaced.branchSlug}`);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [business.id, business.slug, branch.id, branch.slug, branch.name, router]);

  // Hasta entrar a la sucursal, un carrito de otra sucursal no se muestra.
  return cart?.branchId === branch.id ? cart.lines : [];
}
