import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

/** Funciona sin JavaScript: el formulario llama a la Server Action. */
export function SignOutButton({ label = "Salir" }: { label?: string }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOutIcon />
        {label}
      </Button>
    </form>
  );
}
