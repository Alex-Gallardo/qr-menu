"use client";

/**
 * Aviso de pedido nuevo en la bandeja: campanita (Web Audio, sin archivos),
 * vibración y el título de la pestaña parpadeando hasta que alguien acepte.
 * Los navegadores solo dejan sonar después de un toque en la página: el
 * primer toque "despierta" el audio.
 */

let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  return audio;
}

/** Llamar desde un toque del usuario (botón "Activar sonido" o cualquier clic). */
export function unlockSound() {
  const ctx = context();
  if (ctx?.state === "suspended") void ctx.resume();
  return ctx?.state !== "suspended";
}

export const soundReady = () => context()?.state === "running";

/** Dos notas cortas (ding-dong), fuertes pero no estridentes. */
export function playChime() {
  const ctx = context();
  if (!ctx || ctx.state !== "running") return false;
  const now = ctx.currentTime;
  [
    { freq: 880, at: 0 },
    { freq: 660, at: 0.22 },
  ].forEach(({ freq, at }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.4, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.55);
  });
  return true;
}

/** Solo después de un toque en la página: antes, el navegador la bloquea (y lo reclama en consola). */
export function vibrate() {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate([200, 100, 200]);
}

/** Parpadea el título ("(2) Pedidos nuevos") mientras haya pedidos sin aceptar. */
export function blinkTitle(count: number) {
  if (count === 0) return () => {};
  const original = document.title;
  const alert = `(${count}) ${count === 1 ? "Pedido nuevo" : "Pedidos nuevos"}`;
  let on = false;
  const id = window.setInterval(() => {
    on = !on;
    document.title = on ? alert : original;
  }, 1000);
  return () => {
    window.clearInterval(id);
    document.title = original;
  };
}
