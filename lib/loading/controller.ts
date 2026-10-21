/**
 * Reglas del modal "Cargando…" (independientes de React para probarlas con
 * relojes falsos):
 *  - aparece solo si la acción tarda más de 300 ms (evita parpadeos);
 *  - una vez visible, se mantiene al menos 600 ms;
 *  - a los 15 s pasa a "Está tardando más de lo normal" con Reintentar y Cancelar.
 */

export const LOADING_TIMING = { showDelay: 300, minVisible: 600, slowAfter: 15_000 } as const;

export type LoadingTiming = { showDelay: number; minVisible: number; slowAfter: number };

export type LoadingView = { visible: boolean; message: string; slow: boolean };

export const HIDDEN: LoadingView = { visible: false, message: "", slow: false };

export class LoadingCancelledError extends Error {
  constructor() {
    super("La acción se canceló.");
    this.name = "LoadingCancelledError";
  }
}

type Job = {
  message: string;
  action: (signal: AbortSignal) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  controller: AbortController;
  attempt: number;
  done: boolean;
};

export function createLoadingController(
  set: (view: LoadingView) => void,
  timing: LoadingTiming = LOADING_TIMING,
) {
  let job: Job | null = null;
  let view: LoadingView = HIDDEN;
  let shownAt: number | null = null;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let slowTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const update = (next: LoadingView) => {
    view = next;
    set(next);
  };

  const clearTimers = () => {
    clearTimeout(showTimer);
    clearTimeout(slowTimer);
    clearTimeout(hideTimer);
  };

  const hideNow = () => {
    clearTimers();
    shownAt = null;
    update(HIDDEN);
  };

  const startSlowTimer = (j: Job) => {
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      if (job === j && !j.done) update({ visible: true, message: j.message, slow: true });
    }, timing.slowAfter);
  };

  /** Termina el trabajo actual respetando el tiempo mínimo visible. */
  const finish = (j: Job) => {
    if (job !== j) return; // otro trabajo tomó el modal: este ya no lo controla
    job = null;
    clearTimeout(showTimer);
    clearTimeout(slowTimer);
    if (shownAt === null) {
      update(HIDDEN);
      return;
    }
    const remaining = timing.minVisible - (Date.now() - shownAt);
    if (remaining <= 0) hideNow();
    else hideTimer = setTimeout(() => !job && hideNow(), remaining);
  };

  const runAttempt = (j: Job) => {
    j.controller = new AbortController();
    const attempt = ++j.attempt;
    j.action(j.controller.signal).then(
      (value) => {
        if (j.done || j.attempt !== attempt) return;
        j.done = true;
        finish(j);
        j.resolve(value);
      },
      (error: unknown) => {
        if (j.done || j.attempt !== attempt) return;
        j.done = true;
        finish(j);
        j.reject(error);
      },
    );
  };

  return {
    /** Ejecuta la acción mostrando el modal con `message` si tarda. */
    run<T>(message: string, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        clearTimeout(hideTimer);
        const j: Job = {
          message,
          action,
          resolve: resolve as (value: unknown) => void,
          reject,
          controller: new AbortController(),
          attempt: 0,
          done: false,
        };
        job = j;

        if (view.visible) {
          // Ya hay un modal en pantalla: se reutiliza con el mensaje nuevo.
          update({ visible: true, message, slow: false });
        } else {
          clearTimeout(showTimer);
          showTimer = setTimeout(() => {
            if (job !== j || j.done) return;
            shownAt = Date.now();
            update({ visible: true, message, slow: false });
          }, timing.showDelay);
        }
        startSlowTimer(j);
        runAttempt(j);
      });
    },

    /** "Cancelar": aborta la acción y cierra el modal de inmediato. */
    cancel() {
      const j = job;
      if (!j) return;
      j.done = true;
      j.controller.abort();
      job = null;
      hideNow();
      j.reject(new LoadingCancelledError());
    },

    /** "Reintentar": descarta el intento en curso y lo vuelve a lanzar. */
    retry() {
      const j = job;
      if (!j || j.done) return;
      j.controller.abort();
      update({ visible: true, message: j.message, slow: false });
      startSlowTimer(j);
      runAttempt(j);
    },

    getView: () => view,
  };
}

export type LoadingController = ReturnType<typeof createLoadingController>;
