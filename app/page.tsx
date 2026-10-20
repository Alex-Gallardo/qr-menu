import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-content-center gap-3 px-4 text-center">
      <Logo className="justify-center" />
      <h1 className="type-h1">{BRAND.tagline}</h1>
    </main>
  );
}
