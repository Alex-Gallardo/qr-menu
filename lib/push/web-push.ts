import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from "node:crypto";

/**
 * Web Push sin dependencias (node:crypto): cifrado del mensaje con
 * aes128gcm (RFC 8291 + RFC 8188) y firma VAPID (RFC 8292, JWT ES256).
 * Las llaves son P-256 en base64url, el mismo formato que usa `web-push`:
 * pública = punto sin comprimir (65 bytes), privada = escalar d (32 bytes).
 */

export type VapidKeys = { publicKey: string; privateKey: string };
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export const b64url = (buf: Uint8Array) => Buffer.from(buf).toString("base64url");
export const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** Par de llaves VAPID nuevo (se genera una sola vez por entorno). */
export function generateVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  return {
    publicKey: b64url(Buffer.concat([Buffer.from([4]), fromB64url(jwk.x!), fromB64url(jwk.y!)])),
    privateKey: jwk.d!,
  };
}

/** Llave privada VAPID como KeyObject (JWK a partir de d y del punto público). */
function vapidPrivateKey(keys: VapidKeys) {
  const pub = fromB64url(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("Llave pública VAPID inválida");
  return createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: keys.privateKey,
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33)),
    },
    format: "jwk",
  });
}

/**
 * Encabezado Authorization de VAPID para un endpoint: JWT ES256 con el origen
 * del servicio de push (aud), vencimiento (máx. 24 h) y un contacto (sub).
 */
export function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  expiresAtSec = Math.floor(Date.now() / 1000) + 12 * 60 * 60,
) {
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: expiresAtSec, sub: subject })),
  );
  const unsigned = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: vapidPrivateKey(keys),
    dsaEncoding: "ieee-p1363",
  });
  return `vapid t=${unsigned}.${b64url(signature)}, k=${keys.publicKey}`;
}

const RECORD_SIZE = 4096;

/**
 * Cifra el mensaje para una suscripción (RFC 8291). Devuelve el cuerpo listo
 * para el POST: encabezado (salt, rs, llave efímera) + un solo registro.
 * `salt` y `localPrivateKey` solo se pasan en pruebas (vectores del RFC).
 */
export function encryptPayload(
  plaintext: Uint8Array,
  target: Pick<PushTarget, "p256dh" | "auth">,
  testing: { salt?: Uint8Array; localPrivateKey?: Uint8Array } = {},
) {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16)
    throw new Error("Suscripción push inválida");

  const ecdh = createECDH("prime256v1");
  if (testing.localPrivateKey) ecdh.setPrivateKey(Buffer.from(testing.localPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = testing.salt ? Buffer.from(testing.salt) : randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: aes128gcm\0", 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: nonce\0", 12));

  // Un solo registro: mensaje + delimitador 0x02 (último registro), sin relleno.
  const record = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]);
  if (record.length + 16 > RECORD_SIZE) throw new Error("Mensaje push demasiado largo");
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}

export type PushOptions = {
  vapid: VapidKeys;
  /** Contacto para el servicio de push: "mailto:…" o una URL https. */
  subject: string;
  /** Segundos que el servicio guarda el aviso si el teléfono está apagado. */
  ttlSec?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** Un aviso nuevo con el mismo topic reemplaza al pendiente (máx. 32 caracteres base64url). */
  topic?: string;
  timeoutMs?: number;
};

export type PushResult =
  | { ok: true; status: number }
  /** gone: la suscripción ya no existe (404/410) y hay que borrarla. */
  | { ok: false; status: number; gone: boolean; detail: string };

/** Envía un aviso a una suscripción. Nunca lanza por la respuesta del servicio. */
export async function sendPush(
  target: PushTarget,
  payload: unknown,
  options: PushOptions,
): Promise<PushResult> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), target);
  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(target.endpoint, options.vapid, options.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(options.ttlSec ?? 60 * 60),
      Urgency: options.urgency ?? "high",
      ...(options.topic ? { Topic: options.topic } : {}),
    },
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
  if (response.ok) return { ok: true, status: response.status };
  return {
    ok: false,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
    detail: (await response.text().catch(() => "")).slice(0, 200),
  };
}
