import Script from "next/script";

/**
 * Google Analytics 4 (solo landing, registro y asistente). Sin
 * NEXT_PUBLIC_GA_ID no se carga. Sin señales publicitarias ni personalización.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || !/^G-[A-Z0-9]{4,20}$/.test(id)) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","${id}",{allow_google_signals:false,allow_ad_personalization_signals:false});`}
      </Script>
    </>
  );
}
