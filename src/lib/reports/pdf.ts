import { formatNumber } from "./demo";
import { measure, PdfDocument } from "./pdf-writer";
import type { FeederReport } from "./types";

/* Hisobotning A4 maketi. Ranglar ilovaning dizayn tokenlari bilan bir xil. */

const BRAND = "#007cd2";
const BRAND_DEEP = "#0a4f86";
const INK = "#333333";
const INK_MUTED = "#555555";
const INK_SOFT = "#8a8a8a";
const CANVAS = "#f3f3f3";
const WHITE = "#ffffff";
const HAIRLINE = "#e4e4e7";
const GREEN = "#22c55e";
const RED = "#ff383c";
const TREND_UP = "#cf4646";
const TREND_DOWN = "#31ae5f";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_TOP = PAGE_HEIGHT - 52;

/** Matn tepasidan tayanch chizig'igacha (Helvetica cap height ~0.72). */
function baseline(top: number, size: number): number {
  return top + size * 0.72;
}

/** Diagramma o'qi uchun "chiroyli" yuqori chegara: 191 -> 200, 4,7 -> 5. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

interface Column {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
}

class ReportLayout {
  readonly doc = new PdfDocument(PAGE_WIDTH, PAGE_HEIGHT);
  private y = 0;
  private page = 0;

  constructor(private readonly report: FeederReport) {}

  /** Joriy sahifada `space` punkt joy qolmagan bo'lsa - yangi sahifa. */
  private ensure(space: number): void {
    if (this.y + space <= FOOTER_TOP - 12) return;
    this.newPage();
  }

  private newPage(): void {
    this.doc.addPage();
    this.page += 1;
    this.drawFooter();
    this.y = MARGIN;
  }

  private drawFooter(): void {
    const { feeder, generatedAt } = this.report;
    this.doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP, HAIRLINE);
    this.doc.text(`${feeder} · ${generatedAt}`, MARGIN, baseline(FOOTER_TOP + 10, 7.5), {
      size: 7.5,
      color: INK_SOFT,
    });
    this.doc.text(`${this.page}-bet`, MARGIN, baseline(FOOTER_TOP + 10, 7.5), {
      size: 7.5,
      color: INK_SOFT,
      align: "right",
      width: CONTENT_WIDTH,
    });
  }

  private sectionTitle(text: string, note?: string): void {
    this.ensure(34);
    this.doc.rect(MARGIN, this.y + 1, 3, 13, BRAND);
    this.doc.text(text, MARGIN + 10, baseline(this.y, 11.5), {
      size: 11.5,
      bold: true,
      color: INK,
    });
    if (note) {
      this.doc.text(note, MARGIN, baseline(this.y + 2, 8), {
        size: 8,
        color: INK_SOFT,
        align: "right",
        width: CONTENT_WIDTH,
      });
    }
    this.y += 22;
  }

  private header(): void {
    const { title, feeder, substation, range, generatedAt, responsible } = this.report;
    const height = 128;

    this.doc.rect(0, 0, PAGE_WIDTH, height, BRAND);
    // Pastki to'q chiziq - sarlavhaga chuqurlik beradi.
    this.doc.rect(0, height - 5, PAGE_WIDTH, 5, BRAND_DEEP);
    // O'ng tomondagi shaffofroq blok - yorug'lik effekti o'rnida.
    this.doc.rect(PAGE_WIDTH - 168, 0, 168, height - 5, "#1188da");

    this.doc.text("ELEKTR ENERGIYASI ANALITIK PLATFORMASI", MARGIN, baseline(26, 7.5), {
      size: 7.5,
      bold: true,
      color: "#bfe0f6",
    });
    this.doc.text(title, MARGIN, baseline(42, 24), { size: 24, bold: true, color: WHITE });
    this.doc.text(feeder, MARGIN, baseline(78, 11), { size: 11, color: "#e3f1fb" });
    this.doc.text(substation, MARGIN, baseline(95, 9), { size: 9, color: "#bfe0f6" });

    const boxLeft = PAGE_WIDTH - 168 + 18;
    const boxWidth = 168 - 36;
    const rows: Array<[string, string]> = [
      ["Davr", range],
      ["Mas’ul xodim", responsible],
      ["Shakllantirildi", generatedAt],
    ];
    rows.forEach(([label, value], index) => {
      const top = 30 + index * 30;
      this.doc.text(label, boxLeft, baseline(top, 7), { size: 7, color: "#bfe0f6" });
      this.doc.text(
        PdfDocument.ellipsize(value, boxWidth, 9, true),
        boxLeft,
        baseline(top + 11, 9),
        { size: 9, bold: true, color: WHITE },
      );
    });

    this.y = height + 26;
  }

  private summary(): void {
    this.sectionTitle("Umumiy ko’rsatkichlar");

    const gap = 10;
    const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
    const cardHeight = 60;
    const accents = ["#3b82f6", "#22c55e", "#ff383c", "#cb30e0", "#6155f5", "#ac7f5e"];
    const tints = ["#eff6ff", "#effff0", "#ffefef", "#feefff", "#f3efff", "#fff5ef"];

    this.ensure(cardHeight * 2 + gap + 6);

    this.report.summary.forEach((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = MARGIN + column * (cardWidth + gap);
      const top = this.y + row * (cardHeight + gap);

      this.doc.roundedRect(x, top, cardWidth, cardHeight, 7, tints[index]);
      this.doc.roundedRect(x, top + 12, 3, cardHeight - 24, 1.5, accents[index]);

      const textLeft = x + 14;
      const textWidth = cardWidth - 24;
      this.doc.text(item.label, textLeft, baseline(top + 11, 8), {
        size: 8,
        color: INK_MUTED,
      });
      this.doc.text(
        PdfDocument.ellipsize(item.value, textWidth, 14, true),
        textLeft,
        baseline(top + 24, 14),
        { size: 14, bold: true, color: INK },
      );
      this.doc.text(
        PdfDocument.ellipsize(item.hint, textWidth, 7.5),
        textLeft,
        baseline(top + 44, 7.5),
        { size: 7.5, color: item.positive ? TREND_DOWN : TREND_UP },
      );
    });

    this.y += cardHeight * 2 + gap + 24;
  }

  /** Iste'mol/yo'qotish ustunli diagrammasi - jadval oldidan umumiy manzara. */
  private chart(): void {
    const rows = this.report.series;
    const height = 108;
    this.ensure(height + 46);

    const top = this.y;
    this.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, height + 34, 8, "#fafafa");

    const plotLeft = MARGIN + 44;
    const plotRight = PAGE_WIDTH - MARGIN - 14;
    const plotWidth = plotRight - plotLeft;
    const plotTop = top + 14;
    const plotBottom = plotTop + height - 22;
    const max = niceCeil(Math.max(...rows.map((row) => row.billed)) || 1);

    // Gorizontal o'lchov chiziqlari.
    for (let step = 0; step <= 2; step += 1) {
      const value = (max / 2) * step;
      const lineY = plotBottom - (value / max) * (plotBottom - plotTop);
      this.doc.line(plotLeft, lineY, plotRight, lineY, step === 0 ? "#c8c8cc" : HAIRLINE);
      this.doc.text(formatNumber(value, 0), MARGIN, baseline(lineY - 4, 7), {
        size: 7,
        color: INK_SOFT,
        align: "right",
        width: 38,
      });
    }

    const slot = plotWidth / rows.length;
    const barWidth = Math.min(14, slot * 0.62);

    rows.forEach((row, index) => {
      const x = plotLeft + slot * index + (slot - barWidth) / 2;
      const total = (row.billed / max) * (plotBottom - plotTop);
      const lossHeight = (row.loss / max) * (plotBottom - plotTop);
      const consumedHeight = Math.max(0, total - lossHeight);

      this.doc.rect(x, plotBottom - total, barWidth, lossHeight, RED);
      this.doc.rect(x, plotBottom - consumedHeight, barWidth, consumedHeight, GREEN);

      // Yorliqlar zich bo'lib ketmasin.
      const stride = Math.ceil(rows.length / 12);
      if (index % stride === 0) {
        this.doc.text(row.label, x - slot / 2 + barWidth / 2, baseline(plotBottom + 4, 6.5), {
          size: 6.5,
          color: INK_SOFT,
          align: "center",
          width: slot,
        });
      }
    });

    // Izoh (legend).
    const legendTop = plotBottom + 18;
    const legend: Array<[string, string]> = [
      ["Iste’mol", GREEN],
      ["Yo’qotish", RED],
    ];
    let legendX = plotLeft;
    legend.forEach(([label, color]) => {
      this.doc.roundedRect(legendX, legendTop + 1, 7, 7, 1.5, color);
      this.doc.text(label, legendX + 12, baseline(legendTop, 7.5), {
        size: 7.5,
        color: INK_MUTED,
      });
      legendX += 12 + measure(label, 7.5) + 18;
    });

    this.y = top + height + 34 + 22;
  }

  private table(columns: Column[], rows: string[][], accentRow?: (index: number) => string): void {
    const headerHeight = 22;
    const rowHeight = 18;

    const drawHead = () => {
      this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, headerHeight, 5, BRAND);
      // Pastki burchaklar to'g'ri bo'lishi uchun ustidan to'rtburchak.
      this.doc.rect(MARGIN, this.y + headerHeight - 6, CONTENT_WIDTH, 6, BRAND);
      let x = MARGIN;
      columns.forEach((column) => {
        this.doc.text(column.label, x + 8, baseline(this.y + 6, 8), {
          size: 8,
          bold: true,
          color: WHITE,
          align: column.align ?? "left",
          width: column.width - 16,
        });
        x += column.width;
      });
      this.y += headerHeight;
    };

    this.ensure(headerHeight + rowHeight * 3);
    drawHead();

    rows.forEach((cells, index) => {
      if (this.y + rowHeight > FOOTER_TOP - 12) {
        this.newPage();
        drawHead();
      }

      if (index % 2 === 1) this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, rowHeight, CANVAS);
      this.doc.line(MARGIN, this.y + rowHeight, PAGE_WIDTH - MARGIN, this.y + rowHeight, HAIRLINE);

      let x = MARGIN;
      cells.forEach((cell, cellIndex) => {
        const column = columns[cellIndex];
        const isFirst = cellIndex === 0;
        const color = isFirst ? INK : INK_MUTED;
        this.doc.text(
          PdfDocument.ellipsize(cell, column.width - 16, 8.5, isFirst),
          x + 8,
          baseline(this.y + 4.5, 8.5),
          {
            size: 8.5,
            bold: isFirst,
            color: accentRow && cellIndex === cells.length - 1 ? accentRow(index) : color,
            align: column.align ?? "left",
            width: column.width - 16,
          },
        );
        x += column.width;
      });

      this.y += rowHeight;
    });

    this.y += 22;
  }

  private totalsRow(label: string, values: string[], columns: Column[]): void {
    const height = 22;
    this.ensure(height + 6);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, height, 5, "#eef6fd");

    const cells = [label, ...values];
    let x = MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index];
      this.doc.text(cell, x + 8, baseline(this.y + 6.5, 8.5), {
        size: 8.5,
        bold: true,
        color: BRAND,
        align: column.align ?? "left",
        width: column.width - 16,
      });
      x += column.width;
    });
    this.y += height + 24;
  }

  private signatures(): void {
    this.ensure(74);
    const gap = 24;
    const width = (CONTENT_WIDTH - gap) / 2;
    const entries: Array<[string, string]> = [
      ["Mas’ul xodim", this.report.responsible],
      ["Tasdiqladi", ""],
    ];

    entries.forEach(([role, name], index) => {
      const x = MARGIN + index * (width + gap);
      this.doc.text(role, x, baseline(this.y, 8), { size: 8, color: INK_SOFT });
      // Imzo chizig'i, ostida F.I.Sh (tasdiqlovchi bo'sh - qo'lda to'ldiriladi).
      this.doc.line(x, this.y + 30, x + width - 40, this.y + 30, "#c8c8cc");
      this.doc.text(name || "F.I.Sh.", x, baseline(this.y + 36, 8), {
        size: 8,
        color: name ? INK : INK_SOFT,
      });
    });

    this.y += 74;
  }

  build(): Buffer {
    const report = this.report;

    this.page = 1;
    this.drawFooter();
    this.header();
    this.summary();

    this.sectionTitle("Iste’mol dinamikasi", `${report.series.length} ta o’lchov nuqtasi`);
    this.chart();

    const seriesColumns: Column[] = [
      { key: "label", label: report.seriesColumn, width: 95 },
      { key: "billed", label: "Hisoblangan, ming kWh", width: 115, align: "right" },
      { key: "consumed", label: "Iste’mol, ming kWh", width: 105, align: "right" },
      { key: "loss", label: "Yo’qotish, ming kWh", width: 110, align: "right" },
      { key: "share", label: "Ulush, %", width: CONTENT_WIDTH - 425, align: "right" },
    ];
    this.table(
      seriesColumns,
      report.series.map((row) => [
        row.label,
        formatNumber(row.billed),
        formatNumber(row.consumed),
        formatNumber(row.loss),
        formatNumber((row.loss / row.billed) * 100, 2),
      ]),
    );

    const billed = report.series.reduce((sum, row) => sum + row.billed, 0);
    const consumed = report.series.reduce((sum, row) => sum + row.consumed, 0);
    const loss = report.series.reduce((sum, row) => sum + row.loss, 0);
    this.totalsRow(
      "Jami",
      [
        formatNumber(billed),
        formatNumber(consumed),
        formatNumber(loss),
        formatNumber((loss / billed) * 100, 2),
      ],
      seriesColumns,
    );

    this.sectionTitle("Transformatorlar kesimi");
    const transformerColumns: Column[] = [
      { key: "name", label: "Transformator", width: 110 },
      { key: "status", label: "Holat", width: 85 },
      { key: "billed", label: "Hisoblangan", width: 105, align: "right" },
      { key: "consumed", label: "Iste’mol", width: 100, align: "right" },
      { key: "loss", label: "Yo’qotish", width: CONTENT_WIDTH - 400, align: "right" },
    ];
    this.table(
      transformerColumns,
      report.transformers.map((row) => [
        row.name,
        row.status,
        formatNumber(row.billed),
        formatNumber(row.consumed),
        formatNumber(row.loss),
      ]),
    );

    this.sectionTitle("Qoidabuzarliklar");
    this.table(
      [
        { key: "kind", label: "Turi", width: 240 },
        { key: "count", label: "Soni", width: 120, align: "right" },
        { key: "amount", label: "Undirilgan summa", width: CONTENT_WIDTH - 360, align: "right" },
      ],
      report.violations.map((row) => [row.kind, `${row.count} ta`, row.amount]),
    );

    this.sectionTitle("Ishlar");
    this.table(
      [
        { key: "transformer", label: "Transformator", width: 110 },
        { key: "work", label: "Ish", width: 205 },
        { key: "date", label: "Sana", width: 105 },
        { key: "status", label: "Holat", width: CONTENT_WIDTH - 420, align: "right" },
      ],
      report.works.map((row) => [row.transformer, row.work, row.date, row.status]),
      (index) => {
        const status = report.works[index].status;
        if (status === "Bajarilgan") return TREND_DOWN;
        if (status === "Yangi") return BRAND;
        return "#f59e0b";
      },
    );

    this.signatures();
    return this.doc.toBuffer();
  }
}

export function renderReportPdf(report: FeederReport): Buffer {
  return new ReportLayout(report).build();
}
