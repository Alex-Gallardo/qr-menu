import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-content-center gap-4 px-4 text-center">
      <Logo className="justify-center" />
      <h1 className="type-h1">No encontramos esta página</h1>
      <p className="type-body max-w-sm text-muted-foreground">
        Puede que el link esté incompleto o que la página ya no exista.
      </p>
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
