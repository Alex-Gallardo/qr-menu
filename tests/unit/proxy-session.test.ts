import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El proxy corre en cada petición: si Supabase falta o no responde, el sitio
 * público no puede caerse (fue un 500 en todo producción en v0.2.0).
 */

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

const { updateSession } = await import("@/lib/supabase/proxy");
const request = () => new NextRequest("https://ejemplo.test/panel");
/** Valor de relleno sin forma de llave real (gitleaks marca literales que parecen claves). */
const FAKE_KEY = "x".repeat(24);

afterEach(() => {
  vi.unstubAllEnvs();
  getClaims.mockReset();
});

describe("updateSession", () => {
  it("sin variables de Supabase sigue sin sesión, sin lanzar", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { claims, response } = await updateSession(request());
    expect(claims).toBeNull();
    expect(response().status).toBe(200);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("si Supabase no responde, se trata como sin sesión", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", FAKE_KEY);
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockRejectedValue(new Error("fetch failed"));
    const { claims } = await updateSession(request());
    expect(claims).toBeNull();
  });

  it("con sesión válida devuelve los claims", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", FAKE_KEY);
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "a@b.c" } } });
    const { claims } = await updateSession(request());
    expect(claims).toEqual({ sub: "u1", email: "a@b.c" });
  });
});
