import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/**
 * Logo de prueba: PNG cuadrado con fondo de un color y un círculo de otro, para
 * que "Paletas de tu logo" tenga colores que proponer.
 */
export function logoPng(size = 256, bg = [210, 59, 34], fg = [246, 183, 60]) {
  const rows: Buffer[] = [];
  const r = size * 0.32;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filtro 0 + RGB
    for (let x = 0; x < size; x++) {
      const inside = (x - size / 2) ** 2 + (y - size / 2) ** 2 < r * r;
      const [cr, cg, cb] = inside ? fg : bg;
      row.set([cr!, cg!, cb!], 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
