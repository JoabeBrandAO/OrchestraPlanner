/**
 * Gera os ícones do app (#36). São necessários porque, no iPhone, o Web Push só existe
 * para site adicionado à Tela de Início — e para isso o manifest precisa apontar ícones
 * PNG de verdade.
 *
 * Escreve PNG na unha (zlib + CRC) em vez de trazer uma biblioteca de imagem para uma
 * marca provisória de duas formas geométricas. Quando houver identidade visual, isto some
 * e os arquivos passam a vir do design.
 *
 * Uso: `node scripts/generate-icons.mjs`
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/** Fundo (slate 900) e traço (branco) — só para o ícone não ser um quadrado cinza. */
const BACKGROUND = [15, 23, 42];
const FOREGROUND = [248, 250, 252];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * Desenha um relógio esquemático: disco claro com dois ponteiros. Reconhecível em 32px,
 * que é o tamanho em que ele será visto de verdade.
 */
function pixel(x, y, size) {
  const center = size / 2;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.hypot(dx, dy);

  if (distance > size * 0.42) return BACKGROUND;
  if (distance > size * 0.36) return FOREGROUND;

  const thickness = size * 0.035;
  // Ponteiro das horas (para cima) e dos minutos (para a direita).
  const naVertical = Math.abs(dx) < thickness && dy < 0 && dy > -size * 0.22;
  const naHorizontal = Math.abs(dy) < thickness && dx > 0 && dx < size * 0.28;
  return naVertical || naHorizontal ? FOREGROUND : BACKGROUND;
}

function png(size) {
  // Cada linha começa com o byte de filtro (0 = None).
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5, size);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 2; // truecolor RGB
  // 10..12 = compressão, filtro e entrelaçamento padrão (0).

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [file, size] of [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
]) {
  writeFileSync(file, png(size));
  console.log(`${file} (${size}px)`);
}
