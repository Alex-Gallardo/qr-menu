import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name}: menú digital QR con pedidos por WhatsApp`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen al compartir la landing (WhatsApp, redes): marca, lema y un celular con el menú. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#FBF6EE",
        padding: 64,
        gap: 48,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#D23B22" }}>
          {BRAND.name.toLowerCase()}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, color: "#231A17", lineHeight: 1.05 }}>
          Tu menú del día, a un toque
        </div>
        <div style={{ fontSize: 30, color: "#6B5B55" }}>
          Menú digital con QR y pedidos por WhatsApp. Sin comisiones.
        </div>
      </div>
      <div
        style={{
          width: 300,
          height: 520,
          borderRadius: 44,
          background: "#231A17",
          padding: 14,
          display: "flex",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: 32,
            background: "#FBF6EE",
            display: "flex",
            flexDirection: "column",
            padding: 22,
            gap: 14,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 800, color: "#231A17" }}>Menú del día</div>
          {["Desayuno chapín · Q45", "Almuerzo ejecutivo · Q55", "Café de olla · Q15"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                background: "#FFFFFF",
                borderRadius: 16,
                padding: 16,
                fontSize: 20,
                color: "#231A17",
              }}
            >
              {t}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "auto",
              background: "#25D366",
              borderRadius: 999,
              padding: 14,
              fontSize: 20,
              fontWeight: 700,
              color: "#231A17",
            }}
          >
            Pedir por WhatsApp
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
