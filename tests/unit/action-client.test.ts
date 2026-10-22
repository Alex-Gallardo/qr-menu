import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@/lib/sentry", () => ({
  loadBrowserSentry: () => Promise.resolve({ captureException }),
}));

const { FAILED_MESSAGE, OFFLINE_MESSAGE, actionFailureMessage, isNetworkError, runAction } =
  await import("@/lib/action-client");

afterEach(() => {
  vi.unstubAllGlobals();
  captureException.mockReset();
});

describe("isNetworkError", () => {
  it.each(["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."])(
    "fetch que no llegó al servidor (%s)",
    (message) => {
      expect(isNetworkError(new TypeError(message), true)).toBe(true);
    },
  );

  it("sin conexión todo error es de red", () => {
    expect(isNetworkError(new Error("lo que sea"), false)).toBe(true);
  });

  it("una respuesta rara del servidor no es 'se fue el internet'", () => {
    const error = new Error("An unexpected response was received from the server.");
    expect(isNetworkError(error, true)).toBe(false);
    expect(actionFailureMessage(error, true)).toBe(FAILED_MESSAGE);
  });
});

describe("runAction", () => {
  it("devuelve el resultado de la acción", async () => {
    await expect(runAction(async () => ({ ok: true as const }))).resolves.toEqual({ ok: true });
  });

  it("convierte la excepción en un resultado con mensaje y la reporta", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const res = await runAction(() => Promise.reject(new Error("respuesta inesperada")));
    expect(res).toEqual({ ok: false, message: FAILED_MESSAGE });
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());
  });

  it("sin conexión avisa del internet y no reporta a Sentry", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const res = await runAction(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(res).toEqual({ ok: false, message: OFFLINE_MESSAGE });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("deja pasar redirect() de Next", async () => {
    await expect(runAction(async () => redirect("/entrar"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
