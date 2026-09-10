/*
 * Kichik PDF yozuvchi. Tashqi kutubxona ishlatilmadi: hisobot uchun kerak
 * bo'lgani - to'rtburchak, chiziq va Helvetica matn. Shu qadar tor vazifa
 * uchun pdfkit/jspdf ni server bundle'iga qo'shish (va ularning font
 * fayllarini Turbopack bilan kelishtirish) asossiz qimmat.
 *
 * Koordinatalar **chap-yuqoridan** beriladi; PDF ning pastdan yuqoriga
 * o'suvchi o'qiga shu yerda o'giriladi.
 */

/** Helvetica va Helvetica-Bold uchun belgi enlari (1000 em birlikda). */
const WIDTHS_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
  722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

const WIDTHS_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722,
  722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722,
  667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

/** Unicode -> WinAnsi. O'zbekcha matnda uchraydigan tipografik belgilar. */
const WIN_ANSI: Record<number, number> = {
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2026: 0x85,
  0x00a0: 0x20,
};

function toWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (code < 256) bytes.push(code);
    else bytes.push(WIN_ANSI[code] ?? 63);
  }
  return bytes;
}

function charWidth(byte: number, bold: boolean): number {
  const table = bold ? WIDTHS_BOLD : WIDTHS_REGULAR;
  // WinAnsi apostroflari `'` bilan bir xil kenglikda.
  if (byte === 0x91 || byte === 0x92) return table[7];
  if (byte === 0x93 || byte === 0x94) return table[2];
  if (byte === 0x96 || byte === 0x97) return table[13] * 2;
  if (byte < 32 || byte > 126) return table[0];
  return table[byte - 32];
}

/** Matn eni (punktda). */
export function measure(text: string, size: number, bold = false): number {
  let total = 0;
  for (const byte of toWinAnsi(text)) total += charWidth(byte, bold);
  return (total / 1000) * size;
}

function escapeText(text: string): string {
  let out = "";
  for (const byte of toWinAnsi(text)) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

function rgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

export interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  /** `align` uchun mo'ljal kengligi. */
  width?: number;
}

const KAPPA = 0.5523;

export class PdfDocument {
  readonly width: number;
  readonly height: number;
  private pages: string[] = [];
  private current: string[] = [];

  constructor(width = 595.28, height = 841.89) {
    this.width = width;
    this.height = height;
  }

  /** PDF o'qi pastdan yuqoriga - shuning uchun y ni ag'daramiz. */
  private flip(y: number): number {
    return this.height - y;
  }

  addPage(): void {
    if (this.current.length) this.pages.push(this.current.join("\n"));
    this.current = [];
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.current.push(
      `${rgb(color)} rg`,
      `${x.toFixed(2)} ${this.flip(y + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
    );
  }

  roundedRect(x: number, y: number, w: number, h: number, r: number, color: string): void {
    const radius = Math.min(r, w / 2, h / 2);
    const bottom = this.flip(y + h);
    const top = this.flip(y);
    const right = x + w;
    const c = radius * KAPPA;

    this.current.push(
      `${rgb(color)} rg`,
      `${(x + radius).toFixed(2)} ${bottom.toFixed(2)} m`,
      `${(right - radius).toFixed(2)} ${bottom.toFixed(2)} l`,
      `${(right - radius + c).toFixed(2)} ${bottom.toFixed(2)} ${right.toFixed(2)} ${(bottom + radius - c).toFixed(2)} ${right.toFixed(2)} ${(bottom + radius).toFixed(2)} c`,
      `${right.toFixed(2)} ${(top - radius).toFixed(2)} l`,
      `${right.toFixed(2)} ${(top - radius + c).toFixed(2)} ${(right - radius + c).toFixed(2)} ${top.toFixed(2)} ${(right - radius).toFixed(2)} ${top.toFixed(2)} c`,
      `${(x + radius).toFixed(2)} ${top.toFixed(2)} l`,
      `${(x + radius - c).toFixed(2)} ${top.toFixed(2)} ${x.toFixed(2)} ${(top - radius + c).toFixed(2)} ${x.toFixed(2)} ${(top - radius).toFixed(2)} c`,
      `${x.toFixed(2)} ${(bottom + radius).toFixed(2)} l`,
      `${x.toFixed(2)} ${(bottom + radius - c).toFixed(2)} ${(x + radius - c).toFixed(2)} ${bottom.toFixed(2)} ${(x + radius).toFixed(2)} ${bottom.toFixed(2)} c`,
      "f",
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 0.6): void {
    this.current.push(
      `${rgb(color)} RG`,
      `${width} w`,
      `${x1.toFixed(2)} ${this.flip(y1).toFixed(2)} m ${x2.toFixed(2)} ${this.flip(y2).toFixed(2)} l S`,
    );
  }

  /** `y` - matn tayanch chizig'i (baseline). */
  text(value: string, x: number, y: number, options: TextOptions = {}): void {
    const { size = 10, bold = false, color = "#333333", align = "left", width = 0 } = options;
    if (!value) return;

    let left = x;
    if (align !== "left" && width > 0) {
      const textWidth = measure(value, size, bold);
      left = align === "center" ? x + (width - textWidth) / 2 : x + width - textWidth;
    }

    this.current.push(
      "BT",
      `${rgb(color)} rg`,
      `/${bold ? "F2" : "F1"} ${size} Tf`,
      `1 0 0 1 ${left.toFixed(2)} ${this.flip(y).toFixed(2)} Tm`,
      `(${escapeText(value)}) Tj`,
      "ET",
    );
  }

  /** Berilgan kenglikka sig'maydigan matnni "..." bilan qisqartiradi. */
  static ellipsize(value: string, maxWidth: number, size: number, bold = false): string {
    if (measure(value, size, bold) <= maxWidth) return value;
    let text = value;
    while (text.length > 1 && measure(`${text}…`, size, bold) > maxWidth) {
      text = text.slice(0, -1);
    }
    return `${text}…`;
  }

  toBuffer(): Buffer {
    if (this.current.length) this.pages.push(this.current.join("\n"));
    if (!this.pages.length) this.pages.push("");

    const chunks: Buffer[] = [];
    const offsets: number[] = [];
    let position = 0;

    const push = (value: string | Buffer) => {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1");
      chunks.push(buffer);
      position += buffer.length;
    };
    const startObject = (index: number) => {
      offsets[index] = position;
      push(`${index} 0 obj\n`);
    };

    // 1 katalog, 2 sahifalar daraxti, 3.. sahifa/kontent juftlari, oxirida 2 shrift.
    const pageIds = this.pages.map((_, index) => 3 + index * 2);
    const fontRegularId = 3 + this.pages.length * 2;
    const fontBoldId = fontRegularId + 1;
    const totalObjects = fontBoldId;

    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

    startObject(1);
    push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    startObject(2);
    push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>\nendobj\n`,
    );

    this.pages.forEach((content, index) => {
      const pageId = pageIds[index];
      const contentId = pageId + 1;

      startObject(pageId);
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] ` +
          `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>\nendobj\n`,
      );

      const stream = Buffer.from(content, "latin1");
      startObject(contentId);
      push(`<< /Length ${stream.length} >>\nstream\n`);
      push(stream);
      push("\nendstream\nendobj\n");
    });

    startObject(fontRegularId);
    push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    startObject(fontBoldId);
    push(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    );

    const xrefStart = position;
    let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= totalObjects; index += 1) {
      xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    push(xref);
    push(
      `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
    );

    return Buffer.concat(chunks);
  }
}
