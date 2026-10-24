/** Datos estructurados de la landing (guía §10): Organization, SoftwareApplication y FAQPage. */
import type { PlanCard } from "./content";

export function landingJsonLd(input: {
  url: string;
  name: string;
  description: string;
  logoUrl: string;
  plans: PlanCard[];
  faq: readonly { q: string; a: string }[];
}) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    logo: input.logoUrl,
    areaServed: { "@type": "Country", name: "Guatemala" },
  };
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    url: input.url,
    description: input.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es-GT",
    offers: input.plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: String(p.priceGtq),
      priceCurrency: "GTQ",
      ...(p.priceGtq > 0 ? { description: "Mensual; pago por transferencia o depósito" } : {}),
    })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return [organization, app, faq];
}
