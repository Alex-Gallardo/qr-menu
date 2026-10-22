import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  b64url,
  encryptPayload,
  fromB64url,
  generateVapidKeys,
  vapidAuthorization,
} from "@/lib/push/web-push";

// RFC 8291, Apéndice A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** Lo que hace el navegador al recibir el aviso (RFC 8291, lado del user agent). */
function decrypt(body: Buffer, uaPrivate: Buffer, uaPublic: Buffer, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idLen = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + idLen);
  const data = body.subarray(21 + idLen);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const shared = ecdh.computeSecret(asPublic);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, info, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: aes128gcm\0", 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: nonce\0", 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([
    decipher.update(data.subarray(0, data.length - 16)),
    decipher.final(),
  ]);
  expect(out.at(-1)).toBe(2);
  return out.subarray(0, -1).toString();
}

describe("cifrado aes128gcm (RFC 8291)", () => {
  it("reproduce exacto el ejemplo del RFC", () => {
    const body = encryptPayload(
      Buffer.from(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      { salt: fromB64url(RFC.salt), localPrivateKey: fromB64url(RFC.asPrivate) },
    );
    expect(b64url(body)).toBe(RFC.body);
  });

  it("con llave y salt aleatorios, el navegador lo descifra", () => {
    const payload = JSON.stringify({ title: "Nuevo pedido #0042 · Q131.00", body: "María ñ 🍳" });
    const body = encryptPayload(Buffer.from(payload), { p256dh: RFC.uaPublic, auth: RFC.auth });
    expect(
      decrypt(body, fromB64url(RFC.uaPrivate), fromB64url(RFC.uaPublic), fromB64url(RFC.auth)),
    ).toBe(payload);
    // Cada envío usa salt y llave efímera nuevos.
    const again = encryptPayload(Buffer.from(payload), { p256dh: RFC.uaPublic, auth: RFC.auth });
    expect(again.subarray(0, 16).equals(body.subarray(0, 16))).toBe(false);
  });

  it("rechaza suscripciones con llaves mal formadas", () => {
    expect(() => encryptPayload(Buffer.from("x"), { p256dh: "abc", auth: RFC.auth })).toThrow();
    expect(() => encryptPayload(Buffer.from("x"), { p256dh: RFC.uaPublic, auth: "abc" })).toThrow();
  });
});

describe("VAPID (RFC 8292)", () => {
  it("genera llaves P-256 en base64url (pública 65 bytes sin comprimir, privada 32)", () => {
    const keys = generateVapidKeys();
    expect(fromB64url(keys.publicKey)).toHaveLength(65);
    expect(fromB64url(keys.publicKey)[0]).toBe(4);
    expect(fromB64url(keys.privateKey)).toHaveLength(32);
    expect(keys.publicKey).not.toMatch(/[+/=]/);
  });

  it("firma un JWT ES256 verificable con la llave pública, con aud = origen del endpoint", () => {
    const keys = generateVapidKeys();
    const header = vapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc:def",
      keys,
      "mailto:avisos@example.com",
      1_900_000_000,
    );
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, h, c, s, k] = match!;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(fromB64url(h!).toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(fromB64url(c!).toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_900_000_000,
      sub: "mailto:avisos@example.com",
    });
    const pub = fromB64url(keys.publicKey);
    const publicKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: b64url(pub.subarray(1, 33)),
        y: b64url(pub.subarray(33)),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${h}.${c}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        fromB64url(s!),
      ),
    ).toBe(true);
  });
});
