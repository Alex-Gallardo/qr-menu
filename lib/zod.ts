import { z } from "zod";

/**
 * Zod con mensajes en español para la gente (guía §1: sin jerga y sin culpa).
 * Todo el código importa `z` de aquí (regla de ESLint): así este mapa se
 * registra antes de crear cualquier esquema, en el servidor y en el navegador.
 *
 * Solo se usa cuando el esquema no trae su propio mensaje: los mensajes
 * escritos en cada esquema siguen ganando.
 */

export const INVALID_DATA = "Revisa los datos.";
export const STALE_REFERENCE =
  "No encontramos lo que buscas. Recarga la página y probemos otra vez.";

type Issue = z.core.$ZodRawIssue;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function spanishIssueMessage(issue: Issue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined || issue.input === null
        ? "Completa los datos que faltan."
        : INVALID_DATA;
    case "invalid_format":
      if (issue.format === "email") return "Ese correo no parece válido.";
      if (issue.format === "url") return "Ese link no parece válido.";
      // Ids (uuid, cuid…): algo quedó desactualizado en la página, no es culpa de nadie.
      if (/^(uuid|guid|cuid2?|ulid|nanoid)$/.test(issue.format)) return STALE_REFERENCE;
      return INVALID_DATA;
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "string")
        return min <= 1
          ? "Completa este dato."
          : `Escribe al menos ${plural(min, "carácter", "caracteres")}.`;
      if (issue.origin === "array" || issue.origin === "set")
        return min <= 1 ? "Elige al menos una opción." : `Elige al menos ${min}.`;
      if (issue.origin === "number" || issue.origin === "int")
        return `Debe ser ${issue.inclusive === false ? "mayor que" : "al menos"} ${min}.`;
      return INVALID_DATA;
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "string")
        return `Usa como máximo ${plural(max, "carácter", "caracteres")}.`;
      if (issue.origin === "array" || issue.origin === "set") return `Elige como máximo ${max}.`;
      if (issue.origin === "number" || issue.origin === "int")
        return `Debe ser ${issue.inclusive === false ? "menor que" : "como máximo"} ${max}.`;
      if (issue.origin === "file") return "El archivo es demasiado grande.";
      return INVALID_DATA;
    }
    case "invalid_value":
      return "Elige una de las opciones.";
    default:
      return INVALID_DATA;
  }
}

z.config({ customError: spanishIssueMessage });

/** Resultado de una acción cuando la validación falla: el primer mensaje, ya en español. */
export function validationError(error: z.ZodError): { ok: false; message: string } {
  return { ok: false, message: error.issues[0]?.message ?? INVALID_DATA };
}

export { z };
