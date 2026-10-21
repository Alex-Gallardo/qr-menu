import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLoadingController,
  HIDDEN,
  LoadingCancelledError,
  type LoadingView,
} from "@/lib/loading/controller";

/** Acción que se resuelve cuando la prueba lo decide. */
function deferred<T = string>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let views: LoadingView[];
let controller: ReturnType<typeof createLoadingController>;
const view = () => controller.getView();
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  views = [];
  controller = createLoadingController((v) => views.push(v));
});
afterEach(() => vi.useRealTimers());

describe("modal de carga", () => {
  it("no aparece si la acción termina antes de 300 ms", async () => {
    const d = deferred();
    const result = controller.run("Guardando…", () => d.promise);
    await vi.advanceTimersByTimeAsync(299);
    d.resolve("ok");
    await expect(result).resolves.toBe("ok");
    await vi.advanceTimersByTimeAsync(1000);
    expect(views.some((v) => v.visible)).toBe(false);
  });

  it("aparece a los 300 ms con el mensaje contextual", async () => {
    const d = deferred();
    void controller.run("Preparando tu pedido…", () => d.promise);
    await vi.advanceTimersByTimeAsync(299);
    expect(view().visible).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(view()).toEqual({ visible: true, message: "Preparando tu pedido…", slow: false });
  });

  it("una vez visible dura al menos 600 ms (y la promesa no espera ese tiempo)", async () => {
    const d = deferred();
    const result = controller.run("Subiendo tu foto…", () => d.promise);
    await vi.advanceTimersByTimeAsync(400); // visible desde 300
    d.resolve("ok");
    await expect(result).resolves.toBe("ok"); // el llamador sigue sin esperar
    expect(view().visible).toBe(true);
    await vi.advanceTimersByTimeAsync(499); // 300 + 600 = 900
    expect(view().visible).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(view()).toEqual(HIDDEN);
  });

  it("si ya estuvo 600 ms visible, se cierra al terminar", async () => {
    const d = deferred();
    void controller.run("Publicando tu menú…", () => d.promise);
    await vi.advanceTimersByTimeAsync(2000);
    d.resolve("ok");
    await flush();
    expect(view()).toEqual(HIDDEN);
  });

  it("a los 15 s pasa a 'tardando más de lo normal'", async () => {
    const d = deferred();
    void controller.run("Buscando tu ubicación…", () => d.promise);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(view().slow).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(view()).toMatchObject({ visible: true, slow: true });
  });

  it("Cancelar aborta la acción, cierra al instante y rechaza la promesa", async () => {
    let signal: AbortSignal | undefined;
    const result = controller.run("Buscando tu ubicación…", (s) => {
      signal = s;
      return new Promise(() => {});
    });
    await vi.advanceTimersByTimeAsync(15_000);
    controller.cancel();
    expect(signal?.aborted).toBe(true);
    expect(view()).toEqual(HIDDEN);
    await expect(result).rejects.toBeInstanceOf(LoadingCancelledError);
  });

  it("Reintentar relanza la acción, vuelve al mensaje normal y reinicia los 15 s", async () => {
    const attempts: ReturnType<typeof deferred<string>>[] = [];
    const result = controller.run("Preparando tu pedido…", () => {
      const d = deferred();
      attempts.push(d);
      return d.promise;
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(view().slow).toBe(true);

    controller.retry();
    expect(attempts).toHaveLength(2);
    expect(view()).toMatchObject({ visible: true, slow: false });

    attempts[0]!.resolve("viejo"); // el intento descartado no cuenta
    await flush();
    expect(view().visible).toBe(true);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(view().slow).toBe(false);
    attempts[1]!.resolve("nuevo");
    await expect(result).resolves.toBe("nuevo");
  });

  it("los errores de la acción llegan al llamador", async () => {
    const result = controller.run("Guardando…", () => Promise.reject(new Error("sin red")));
    await expect(result).rejects.toThrow("sin red");
    await vi.advanceTimersByTimeAsync(1000);
    expect(view()).toEqual(HIDDEN);
  });

  it("una acción nueva reutiliza el modal visible con su mensaje", async () => {
    const a = deferred();
    const b = deferred();
    void controller.run("Guardando…", () => a.promise);
    await vi.advanceTimersByTimeAsync(400);
    void controller.run("Publicando tu menú…", () => b.promise);
    expect(view()).toMatchObject({ visible: true, message: "Publicando tu menú…" });
    a.resolve("ok"); // la anterior ya no controla el modal
    await vi.advanceTimersByTimeAsync(1000);
    expect(view().visible).toBe(true);
    b.resolve("ok");
    await flush();
    expect(view()).toEqual(HIDDEN);
  });
});
