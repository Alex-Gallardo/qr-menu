// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingOverlay } from "@/components/feedback/loading-overlay";
import { LoadingCancelledError } from "@/lib/loading/controller";
import { setLoadingProgress, useLoading, withLoading } from "@/lib/loading/store";

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("<LoadingOverlay />", () => {
  it("muestra el mensaje en una región accesible solo después de 300 ms", async () => {
    render(<LoadingOverlay />);
    const dialog = screen.getByLabelText("Cargando", { selector: "dialog" });
    let resolve!: (v: string) => void;
    void withLoading("Subiendo tu foto…", () => new Promise<string>((r) => (resolve = r)));

    await advance(299);
    expect(dialog.hasAttribute("open")).toBe(false);

    await advance(1);
    expect(dialog.hasAttribute("open")).toBe(true);
    const status = screen.getByRole("status", { hidden: true });
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Subiendo tu foto…");

    resolve("ok");
    await advance(600);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("a los 15 s ofrece Reintentar y Cancelar; Cancelar cierra y rechaza", async () => {
    render(<LoadingOverlay />);
    const result = withLoading("Preparando tu pedido…", () => new Promise(() => {}));
    const outcome = result.catch((e: unknown) => e);

    await advance(15_000);
    expect(screen.getByText("Está tardando más de lo normal")).toBeTruthy();
    const cancel = screen.getByRole("button", { name: "Cancelar", hidden: true });
    expect(screen.getByRole("button", { name: "Reintentar", hidden: true })).toBeTruthy();

    fireEvent.click(cancel);
    await advance(0);
    expect(await outcome).toBeInstanceOf(LoadingCancelledError);
    expect(screen.getByLabelText("Cargando", { selector: "dialog" }).hasAttribute("open")).toBe(
      false,
    );
  });

  it("muestra la barra de avance de una subida y la limpia al cerrar", async () => {
    render(<LoadingOverlay />);
    let resolve!: () => void;
    void withLoading("Subiendo tu foto…", () => new Promise<void>((r) => (resolve = r)));
    await advance(300);
    expect(screen.queryByRole("progressbar", { hidden: true })).toBeNull();

    act(() => setLoadingProgress(0.456));
    const bar = screen.getByRole("progressbar", { hidden: true });
    expect(bar.getAttribute("aria-valuenow")).toBe("46");
    act(() => setLoadingProgress(2));
    expect(bar.getAttribute("aria-valuenow")).toBe("100");

    resolve();
    await advance(600);
    expect(useLoading.getState().progress).toBeNull();
  });
});
