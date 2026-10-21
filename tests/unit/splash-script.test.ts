// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSplash, splashInlineScript } from "@/features/public-menu/splash-script";

/** Ejecuta el script tal como va en línea (texto), sin acceso al módulo. */
function runInline(root: HTMLElement) {
  const script = document.createElement("script");
  root.appendChild(script);
  const code = splashInlineScript().replace("document.currentScript", "__script");
  new Function("__script", code)(script);
}

function mount(freq: string, key = "negocio-1") {
  const root = document.createElement("div");
  root.dataset.key = key;
  root.dataset.freq = freq;
  root.dataset.total = "1800";
  root.innerHTML = `<div data-splash-panel></div>`;
  document.body.appendChild(root);
  return root;
}

const endExit = (root: HTMLElement) => {
  const panel = root.querySelector("[data-splash-panel]")!;
  const e = new Event("animationend");
  Object.assign(e, { animationName: "splash-out-lift" });
  panel.dispatchEvent(e);
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("arranque de la bienvenida", () => {
  it("el script en línea es autocontenido y se muestra la primera vez", () => {
    const root = mount("once_per_session");
    runInline(root);
    expect(root.dataset.splash).toBe("on");
    endExit(root);
    expect(root.dataset.splash).toBe("done");
  });

  it("una vez por sesión: la segunda visita no la muestra (por negocio)", () => {
    runInline(mount("once_per_session"));
    expect(mount("once_per_session").dataset.splash).toBeUndefined();
    const second = mount("once_per_session");
    runInline(second);
    expect(second.dataset.splash).toBe("off");
    const other = mount("once_per_session", "otro-negocio");
    runInline(other);
    expect(other.dataset.splash).toBe("on");
  });

  it("solo la primera visita: se recuerda en el dispositivo", () => {
    runSplash(mount("first_visit"));
    sessionStorage.clear(); // nueva sesión
    const again = mount("first_visit");
    runSplash(again);
    expect(again.dataset.splash).toBe("off");
  });

  it("siempre: se muestra cada vez", () => {
    runSplash(mount("always"));
    const again = mount("always");
    runSplash(again);
    expect(again.dataset.splash).toBe("on");
  });

  it("corre una sola vez aunque el componente lo llame al hidratar", () => {
    const root = mount("once_per_session");
    runInline(root);
    runSplash(root); // layout effect
    expect(root.dataset.splash).toBe("on");
  });

  it("tocar la salta", () => {
    const root = mount("always");
    runSplash(root);
    root.querySelector("[data-splash-panel]")!.dispatchEvent(new Event("pointerdown"));
    expect(root.dataset.splash).toBe("skip");
    endExit(root);
    expect(root.dataset.splash).toBe("done");
  });

  it("si no llega animationend, termina igual", () => {
    const root = mount("always");
    runSplash(root);
    vi.advanceTimersByTime(2800);
    expect(root.dataset.splash).toBe("done");
  });
});
