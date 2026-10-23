import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";

const captureException = vi.fn();
vi.mock("@/lib/sentry", () => ({
  loadBrowserSentry: () => Promise.resolve({ captureException }),
}));
const toast = vi.fn();
vi.mock("sonner", () => ({ toast: (...args: unknown[]) => toast(...args) }));

const {
  FAILED_MESSAGE,
  OFFLINE_MESSAGE,
  STALE_MESSAGE,
  actionFailureMessage,
  isNetworkError,
  isStaleAppError,
  runAction,
} = await import("@/lib/action-client");

afterEach(() => {
  vi.unstubAllGlobals();
  captureException.mockReset();
  toast.mockReset();
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

describe("versión vieja de la página", () => {
  const notFound = new UnrecognizedActionError('Server Action "7f…" was not found on the server.');

  it("acción que ya no existe en el servidor o archivo JS de la versión anterior", () => {
    expect(isStaleAppError(notFound)).toBe(true);
    expect(isStaleAppError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isStaleAppError(new Error("Failed to load chunk /_next/static/chunks/a.js"))).toBe(true);
    expect(isStaleAppError(new Error("respuesta inesperada"))).toBe(false);
    expect(actionFailureMessage(notFound, true)).toBe(STALE_MESSAGE);
  });

  it("pide recargar (un solo aviso con Recargar) y no lo manda a Sentry", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const res = await runAction(() => Promise.reject(notFound));
    await runAction(() => Promise.reject(notFound));
    expect(res).toEqual({ ok: false, message: STALE_MESSAGE });
    expect(toast).toHaveBeenCalledTimes(2);
    const [message, options] = toast.mock.calls[0] as [
      string,
      { id: string; action: { label: string } },
    ];
    expect(message).toBe(STALE_MESSAGE);
    expect(options.id).toBe("version-nueva"); // sonner reemplaza el aviso en vez de apilarlo
    expect(options.action.label).toBe("Recargar");
    await new Promise((r) => setTimeout(r, 0));
    expect(captureException).not.toHaveBeenCalled();
  });
});
