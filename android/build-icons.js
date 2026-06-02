// Generates maskable PWA icons (no external deps) using Node's zlib.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size) {
  const cx = size / 2, cy = size / 2, r = size * 0.34;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      // background gradient (dark)
      let R = 0x1c, G = 0x1c, B = 0x20;
      // crystal diamond (rotated square)
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d < r) {
        const t = 1 - d / r; // 0..1 toward center
        R = Math.round(0x2a + t * 0x10);
        G = Math.round(0xb8 + t * 0x30);
        B = Math.round(0xc8 + t * 0x30);
      } else if (d < r + size * 0.012) {
        R = 0x10; G = 0x70; B = 0x80; // edge stroke
      }
      raw[p++] = R; raw[p++] = G; raw[p++] = B; raw[p++] = 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [192, 512]) {
  fs.writeFileSync(path.join(__dirname, `icon-${s}.png`), png(s));
  console.log('wrote icon-' + s + '.png');
}
