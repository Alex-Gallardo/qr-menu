import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error(`Carácter base32 inválido: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Código TOTP de 6 dígitos (RFC 6238, SHA-1, 30 s): el que mostraría la app de autenticación. */
export function totp(secret: string, now: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/**
 * Diferencia entre el reloj de Supabase y el de esta PC (en ms). El TOTP solo
 * acepta ±30 s y la PC puede ir atrasada: se usa la hora del encabezado Date.
 */
export async function serverClockOffset(supabaseUrl: string): Promise<number> {
  const before = Date.now();
  const res = await fetch(`${supabaseUrl}/auth/v1/health`);
  const after = Date.now();
  const date = res.headers.get("date");
  if (!date) return 0;
  // El encabezado Date tiene resolución de 1 s: se compara contra el punto medio.
  return new Date(date).getTime() + 500 - (before + after) / 2;
}
