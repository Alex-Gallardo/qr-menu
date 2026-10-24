import { ArrowRightIcon, CheckIcon, MinusIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroPhone } from "@/features/marketing/components/hero-phone";
import { Faq, PricingCards } from "@/features/marketing/components/pricing";
import { ctaClass, salesPhone } from "@/features/marketing/components/site-chrome";
import { TrackedLink } from "@/features/marketing/components/tracked-link";
import {
  AUDIENCES,
  BENEFITS,
  BRANCHES_BLOCK,
  comparisonRows,
  FAQ,
  HERO,
  landingSeo,
  planCards,
  salesWhatsappUrl,
  STEPS,
} from "@/features/marketing/content";
import { landingJsonLd } from "@/features/marketing/json-ld";
import { getLandingData, SOCIAL_PROOF_MIN_ORDERS } from "@/features/marketing/server";
import { serializeJsonLd } from "@/features/public-menu/json-ld";
import { qrMatrix, qrSvg } from "@/features/qr/matrix";
import { BRAND } from "@/lib/brand";

const seo = landingSeo(BRAND.name);

export const metadata: Metadata = {
  title: { absolute: seo.title },
  description: seo.description,
  alternates: {
    canonical: "/",
    languages: { "es-GT": "/", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    locale: "es_GT",
    url: "/",
    siteName: BRAND.name,
    title: seo.title,
    description: seo.description,
  },
  twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
};

/**
 * Landing (guía §10): que el dueño toque "Pruébalo gratis" o "Escríbeme por
 * WhatsApp". Estática (los números se refrescan cada hora) y sin JavaScript
 * propio salvo el aviso de los clics a GA4.
 */
export default async function Home() {
  const data = await getLandingData();
  const plans = planCards(data.prices);
  const compare = comparisonRows(BRAND.name);
  const phone = salesPhone();
  const demoUrl = new URL("/demo", BRAND.url).toString();
  const demoQr = qrSvg({ matrix: qrMatrix(demoUrl), color: "#231A17", logo: null });
  const jsonLd = landingJsonLd({
    url: new URL("/", BRAND.url).toString(),
    name: BRAND.name,
    description: seo.description,
    logoUrl: new URL("/icon.svg", BRAND.url).toString(),
    plans,
    faq: FAQ,
  });

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      {/* 2 · Hero */}
      <section className="mx-auto grid max-w-landing items-center gap-10 px-4 py-12 md:grid-cols-[1fr_auto] md:py-20">
        <div className="grid gap-5">
          <h1 className="type-display text-balance">{HERO.title}</h1>
          <p className="type-body max-w-xl text-lg text-muted-foreground">{HERO.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <TrackedLink
              href="/registro"
              event="cta_trial_click"
              place="hero"
              className={`${ctaClass} h-14 bg-primary px-7 text-base text-primary-foreground`}
            >
              Crear mi menú gratis
              <ArrowRightIcon aria-hidden className="size-5" />
            </TrackedLink>
            <TrackedLink
              href="/demo"
              event="demo_open"
              place="hero"
              className={`${ctaClass} h-14 border border-border bg-card px-7 text-base`}
            >
              Ver demo
            </TrackedLink>
          </div>
          <p className="text-sm text-muted-foreground">{HERO.micro}</p>
        </div>
        <HeroPhone />
      </section>

      {/* 3 · Prueba social (solo con números reales que dicen algo) */}
      {data.ordersThisMonth >= SOCIAL_PROOF_MIN_ORDERS ? (
        <section aria-label="En números" className="border-y border-border bg-card">
          <p className="mx-auto max-w-landing px-4 py-5 text-center text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">
              {data.ordersThisMonth.toLocaleString("es-GT")}
            </strong>{" "}
            pedidos este mes en restaurantes de Ciudad de Guatemala, Antigua y Xela.
          </p>
        </section>
      ) : null}

      {/* 4 · Cómo funciona */}
      <Section title="Así de fácil" id="como-funciona">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="grid content-start gap-2 rounded-2xl border border-border bg-card p-6 shadow-1"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="type-h3">{s.title}</h3>
              <p className="text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 5 · Demo en vivo */}
      <section className="bg-frijol text-white">
        <div className="mx-auto grid max-w-landing items-center gap-8 px-4 py-14 md:grid-cols-[auto_1fr]">
          <div
            role="img"
            aria-label="Código QR del menú de demostración"
            className="mx-auto w-52 overflow-hidden rounded-2xl bg-white p-2 [&_svg]:block [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: demoQr }}
          />
          <div className="grid gap-4">
            <h2 className="type-h2">Escanéalo ahora con tu celular</h2>
            <p className="text-lg text-white/80">
              Es el menú de un café de ejemplo: mira cómo cambia del desayuno al almuerzo, abre un
              platillo y arma un pedido. Así lo verían tus clientes.
            </p>
            <TrackedLink
              href="/demo"
              event="demo_open"
              place="demo-qr"
              className={`${ctaClass} h-12 justify-self-start bg-white text-frijol`}
            >
              Abrir demo
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* 6 · Beneficios */}
      <Section title="Todo lo que tu menú necesita">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="grid content-start gap-1 rounded-2xl bg-card p-6 shadow-1">
              <h3 className="type-h3 flex items-center gap-2">
                <CheckIcon aria-hidden className="size-5 text-aguacate" />
                {b.title}
              </h3>
              <p className="text-muted-foreground">{b.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 7 · Varias sucursales + 8 · Para quién */}
      <section className="mx-auto grid max-w-landing gap-6 px-4 pb-14 md:grid-cols-2">
        <div className="grid content-start gap-3 rounded-2xl bg-nube p-8">
          <h2 className="type-h2">{BRANCHES_BLOCK.title}</h2>
          <p className="text-lg text-foreground/85">{BRANCHES_BLOCK.text}</p>
        </div>
        <div className="grid content-start gap-3 rounded-2xl border border-border bg-card p-8">
          <h2 className="type-h2">Hecho para</h2>
          <ul className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <li key={a} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 9 · Comparativa */}
      <Section title={`¿Por qué ${BRAND.name}?`}>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-4" />
                {compare.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`p-4 font-semibold ${i === 2 ? "bg-primary/10 text-tomate-700" : "text-muted-foreground"}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <th scope="row" className="p-4 font-semibold">
                    {r.label}
                  </th>
                  {r.values.map((v, i) => (
                    <td
                      key={i}
                      className={`p-4 ${i === 2 ? "bg-primary/5 font-semibold" : "text-muted-foreground"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {v === "No" ? (
                          <XIcon aria-hidden className="size-4 text-destructive" />
                        ) : v === "—" ? (
                          <MinusIcon aria-hidden className="size-4" />
                        ) : i === 2 ? (
                          <CheckIcon aria-hidden className="size-4 text-aguacate" />
                        ) : null}
                        {v}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 10 · Precios */}
      <Section title="Precios claros, sin comisiones" id="precios">
        <PricingCards plans={plans} />
        <p className="text-center text-sm text-muted-foreground">
          Pago por transferencia o depósito, mensual o anual.{" "}
          <Link href="/precios" className="font-semibold text-tomate-700 hover:underline">
            Comparar todo lo que incluye cada plan
          </Link>
        </p>
      </Section>

      {/* 12 · Preguntas frecuentes */}
      <Section title="Preguntas frecuentes" id="preguntas">
        <Faq items={FAQ} />
      </Section>

      {/* 13 · CTA final */}
      <section className="mx-auto max-w-landing px-4 pb-16">
        <div className="grid justify-items-center gap-5 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground">
          <h2 className="type-h1">Tu menú listo hoy mismo</h2>
          <p className="max-w-xl text-lg">{HERO.micro}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <TrackedLink
              href="/registro"
              event="cta_trial_click"
              place="cta-final"
              className={`${ctaClass} h-14 bg-white px-7 text-base text-tomate-700`}
            >
              Pruébalo gratis
            </TrackedLink>
            {phone ? (
              <TrackedLink
                href={salesWhatsappUrl(phone, BRAND.name)}
                target="_blank"
                rel="noopener noreferrer"
                event="cta_whatsapp_click"
                place="cta-final"
                className={`${ctaClass} h-14 border border-white/60 px-7 text-base`}
              >
                Escríbeme por WhatsApp
              </TrackedLink>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto grid max-w-landing scroll-mt-20 gap-6 px-4 py-14">
      <h2 className="type-h1 text-center text-balance">{title}</h2>
      {children}
    </section>
  );
}
