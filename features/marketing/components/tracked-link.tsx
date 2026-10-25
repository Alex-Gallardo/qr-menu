"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { trackGa, type GaEvent } from "../analytics";

/** Link de la landing que avisa a GA4 al tocarlo (prueba, WhatsApp, demo). */
export function TrackedLink({
  event,
  place,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { event: GaEvent; place: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackGa(event, { place });
        onClick?.(e);
      }}
    />
  );
}
