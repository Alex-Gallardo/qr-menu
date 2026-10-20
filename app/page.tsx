import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="home">
      <h1>{BRAND.name}</h1>
      <p>{BRAND.tagline}</p>
    </main>
  );
}
