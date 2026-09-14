import { count, dec, EMPTY, num, percent } from "@/lib/format";

import { measure, PdfDocument } from "./pdf-writer";
import { NOT_UPLOADED, type ReportSeriesRow, type ReportTone, type ScopeReport } from "./types";

/* Hisobotning A4 maketi. Ranglar ilovaning dizayn tokenlari bilan bir xil. */

const BRAND = "#007cd2";
const BRAND_DEEP = "#0a4f86";
const INK = "#333333";
const INK_MUTED = "#555555";
const INK_SOFT = "#8a8a8a";
const CANVAS = "#f3f3f3";
const WHITE = "#ffffff";
const HAIRLINE = "#e4e4e7";
const TREND_UP = "#cf4646";
const TREND_DOWN = "#31ae5f";

/** Oqim seriyalari - sahifalardagi "Oqim dinamikasi" kartasi bilan bir xil ranglar. */
const SERIES_COLORS = { total: "#467acf", useful: "#46cf61", loss: "#cf4646" } as const;

const TONE_COLOR: Record<ReportTone, string> = {
  good: TREND_DOWN,
  bad: TREND_UP,
  neutral: INK_SOFT,
};

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
  if (!(value > 0) || !Number.isFinite(value)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/** Diagramma birligi - eng katta qiymatga qarab kWh / ming kWh / mln kWh. */
function chartUnit(peak: number): { divisor: number; unit: string } {
  if (peak >= 1_000_000) return { divisor: 1_000_000, unit: "mln kWh" };
  if (peak >= 1_000) return { divisor: 1_000, unit: "ming kWh" };
  return { divisor: 1, unit: "kWh" };
}

/** Katak matni: kWh butun songa, foiz 2 xonagacha. */
const kwh = (value: number) => num(value);
const share = (value: number | null) => (value == null ? EMPTY : percent(value, 2));

interface Column {
  key: string;
  label: string;
  width: number;
  align?: "left" | "center" | "right";
}

/** Ustun kengliklari yig'indisi kontent kengligiga teng bo'lsin - oxirgisi qoldiqni oladi. */
function fitColumns(columns: Column[]): Column[] {
  const used = columns.slice(0, -1).reduce((total, column) => total + column.width, 0);
  return columns.map((column, index) =>
    index === columns.length - 1 ? { ...column, width: CONTENT_WIDTH - used } : column,
  );
}

class ReportLayout {
  readonly doc = new PdfDocument(PAGE_WIDTH, PAGE_HEIGHT);
  private y = 0;
  private page = 0;

  constructor(private readonly report: ScopeReport) {}

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
    const { scopeName, title, periodLabel, generatedAt } = this.report;
    this.doc.line(MARGIN, FOOTER_TOP, PAGE_WIDTH - MARGIN, FOOTER_TOP, HAIRLINE);
    this.doc.text(
      PdfDocument.ellipsize(`${scopeName} · ${title} · ${periodLabel} · ${generatedAt}`, CONTENT_WIDTH - 50, 7.5),
      MARGIN,
      baseline(FOOTER_TOP + 10, 7.5),
      { size: 7.5, color: INK_SOFT },
    );
    this.doc.text(`${this.page}-bet`, MARGIN, baseline(FOOTER_TOP + 10, 7.5), {
      size: 7.5,
      color: INK_SOFT,
      align: "right",
      width: CONTENT_WIDTH,
    });
  }

  /**
   * Bo'lim sarlavhasi. `reserve` - sarlavhadan keyin shu sahifada bo'lishi
   * kerak bo'lgan joy (jadval boshi va bir-ikki qator): aks holda sarlavha
   * sahifa oxirida yolg'iz qolib, mazmuni keyingi sahifaga o'tib ketardi.
   */
  private sectionTitle(text: string, note?: string, reserve = 80): void {
    this.ensure(22 + reserve);
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

  /** Ma'lumotsiz bo'lim: kulrang quti ichida qisqa matn. */
  private emptyNote(text: string): void {
    const height = 32;
    this.ensure(height + 22);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, height, 6, "#fafafa");
    this.doc.text(text, MARGIN, baseline(this.y + 11.5, 9), {
      size: 9,
      color: INK_SOFT,
      align: "center",
      width: CONTENT_WIDTH,
    });
    this.y += height + 22;
  }

  private header(): void {
    const { title, scopeName, scopeContext, periodLabel, reportDate, responsible, generatedAt } = this.report;
    const height = 128;
    const boxWidth = 188;

    this.doc.rect(0, 0, PAGE_WIDTH, height, BRAND);
    // Pastki to'q chiziq - sarlavhaga chuqurlik beradi.
    this.doc.rect(0, height - 5, PAGE_WIDTH, 5, BRAND_DEEP);
    // O'ng tomondagi ochroq blok - hisobot rekvizitlari.
    this.doc.rect(PAGE_WIDTH - boxWidth, 0, boxWidth, height - 5, "#1188da");

    const leftWidth = PAGE_WIDTH - boxWidth - MARGIN - 16;
    this.doc.text("ELEKTR ENERGIYASI ANALITIK PLATFORMASI", MARGIN, baseline(26, 7.5), {
      size: 7.5,
      bold: true,
      color: "#bfe0f6",
    });
    this.doc.text(title, MARGIN, baseline(42, 24), { size: 24, bold: true, color: WHITE });
    this.doc.text(PdfDocument.ellipsize(scopeName, leftWidth, 12, true), MARGIN, baseline(76, 12), {
      size: 12,
      bold: true,
      color: "#e3f1fb",
    });
    this.doc.text(PdfDocument.ellipsize(scopeContext, leftWidth, 9), MARGIN, baseline(94, 9), {
      size: 9,
      color: "#bfe0f6",
    });

    const boxLeft = PAGE_WIDTH - boxWidth + 16;
    const boxInner = boxWidth - 32;
    const rows: Array<[string, string]> = [
      ["Davr", periodLabel],
      ["Ma’lumot holati", reportDate],
      ...(responsible ? ([["Mas’ul xodim", responsible]] as Array<[string, string]>) : []),
      ["Shakllantirildi", generatedAt],
    ];
    const step = rows.length > 3 ? 24 : 30;
    rows.forEach(([label, value], index) => {
      const top = (rows.length > 3 ? 20 : 26) + index * step;
      this.doc.text(label, boxLeft, baseline(top, 7), { size: 7, color: "#bfe0f6" });
      this.doc.text(PdfDocument.ellipsize(value, boxInner, 9, true), boxLeft, baseline(top + 10, 9), {
        size: 9,
        bold: true,
        color: WHITE,
      });
    });

    this.y = height + 26;
  }

  private summary(): void {
    this.sectionTitle("Umumiy ko’rsatkichlar", `${this.report.monthLabel} holati`);

    const gap = 10;
    const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
    const cardHeight = 60;
    const accents = ["#3b82f6", "#22c55e", "#ff383c", "#cb30e0", "#6155f5", "#ac7f5e"];
    const tints = ["#eff6ff", "#effff0", "#ffefef", "#feefff", "#f3efff", "#fff5ef"];
    const rowsCount = Math.ceil(this.report.summary.length / 3);

    this.ensure(cardHeight * rowsCount + gap * (rowsCount - 1) + 6);

    this.report.summary.forEach((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = MARGIN + column * (cardWidth + gap);
      const top = this.y + row * (cardHeight + gap);

      this.doc.roundedRect(x, top, cardWidth, cardHeight, 7, tints[index % tints.length]);
      this.doc.roundedRect(x, top + 12, 3, cardHeight - 24, 1.5, accents[index % accents.length]);

      const textLeft = x + 14;
      const textWidth = cardWidth - 24;
      this.doc.text(item.label, textLeft, baseline(top + 11, 8), { size: 8, color: INK_MUTED });
      this.doc.text(PdfDocument.ellipsize(item.value, textWidth, 14, true), textLeft, baseline(top + 24, 14), {
        size: 14,
        bold: true,
        color: INK,
      });
      this.doc.text(PdfDocument.ellipsize(item.hint, textWidth, 7.5), textLeft, baseline(top + 44, 7.5), {
        size: 7.5,
        color: TONE_COLOR[item.tone],
      });
    });

    this.y += cardHeight * rowsCount + gap * (rowsCount - 1) + 24;
  }

  /**
   * Ustunli diagramma: har bir qatorga uchta ustun (umumiy, foydali,
   * yo'qotish). Yo'qotish manfiy bo'lsa ustun nol chizig'idan pastga tushadi.
   */
  private chart(rows: readonly ReportSeriesRow[]): void {
    const height = 118;
    this.ensure(height + 46);

    const values = rows.flatMap((row) => [row.totalKwh, row.usefulKwh, row.lossKwh]);
    const { divisor, unit } = chartUnit(Math.max(0, ...values.map(Math.abs)));
    const scaledValues = values.map((value) => value / divisor);
    const hi = niceCeil(Math.max(0, ...scaledValues));
    const lowest = Math.min(0, ...scaledValues);
    const lo = lowest < 0 ? -niceCeil(-lowest) : 0;

    const top = this.y;
    this.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, height + 34, 8, "#fafafa");

    const plotLeft = MARGIN + 46;
    const plotRight = PAGE_WIDTH - MARGIN - 14;
    const plotWidth = plotRight - plotLeft;
    const plotTop = top + 16;
    const plotBottom = plotTop + height - 26;
    const toY = (value: number) => plotBottom - ((value - lo) / (hi - lo)) * (plotBottom - plotTop);

    // Gorizontal o'lchov chiziqlari: pastki chegara, nol, yarim va yuqori.
    const ticks = Array.from(new Set([lo, 0, hi / 2, hi])).sort((a, b) => a - b);
    ticks.forEach((value) => {
      const lineY = toY(value);
      this.doc.line(plotLeft, lineY, plotRight, lineY, value === 0 ? "#c8c8cc" : HAIRLINE);
      this.doc.text(dec(value, value !== 0 && Math.abs(value) < 10 ? 1 : 0), MARGIN, baseline(lineY - 4, 7), {
        size: 7,
        color: INK_SOFT,
        align: "right",
        width: 40,
      });
    });
    this.doc.text(unit, plotLeft, baseline(top + 5, 6.5), { size: 6.5, color: INK_SOFT });

    const slot = plotWidth / rows.length;
    const barWidth = Math.min(10, (slot * 0.72) / 3);
    const stride = Math.ceil(rows.length / 14);
    const zeroY = toY(0);

    rows.forEach((row, index) => {
      const groupLeft = plotLeft + slot * index + (slot - barWidth * 3) / 2;
      const bars: Array<[number, string]> = [
        [row.totalKwh, SERIES_COLORS.total],
        [row.usefulKwh, SERIES_COLORS.useful],
        [row.lossKwh, SERIES_COLORS.loss],
      ];
      bars.forEach(([value, color], barIndex) => {
        const valueY = toY(value / divisor);
        const barTop = Math.min(valueY, zeroY);
        const barHeight = Math.abs(zeroY - valueY);
        if (barHeight > 0) this.doc.rect(groupLeft + barWidth * barIndex, barTop, barWidth, barHeight, color);
      });

      // Yorliqlar zich bo'lib ketmasin.
      if (index % stride === 0) {
        const labelWidth = slot * stride;
        this.doc.text(
          PdfDocument.ellipsize(row.label, labelWidth - 2, 6.5),
          plotLeft + slot * index + slot / 2 - labelWidth / 2,
          baseline(plotBottom + 5, 6.5),
          { size: 6.5, color: INK_SOFT, align: "center", width: labelWidth },
        );
      }
    });

    // Izoh (legend).
    const legendTop = plotBottom + 20;
    const legend: Array<[string, string]> = [
      ["Umumiy oqim", SERIES_COLORS.total],
      ["Foydali oqim", SERIES_COLORS.useful],
      ["Yo’qotish", SERIES_COLORS.loss],
    ];
    let legendX = plotLeft;
    legend.forEach(([label, color]) => {
      this.doc.roundedRect(legendX, legendTop + 1, 7, 7, 1.5, color);
      this.doc.text(label, legendX + 12, baseline(legendTop, 7.5), { size: 7.5, color: INK_MUTED });
      legendX += 12 + measure(label, 7.5) + 18;
    });

    this.y = top + height + 34 + 22;
  }

  private table(columns: Column[], rows: string[][]): void {
    const headerHeight = 22;
    const rowHeight = 18;

    const drawHead = () => {
      this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, headerHeight, 5, BRAND);
      // Pastki burchaklar to'g'ri bo'lishi uchun ustidan to'rtburchak.
      this.doc.rect(MARGIN, this.y + headerHeight - 6, CONTENT_WIDTH, 6, BRAND);
      let x = MARGIN;
      columns.forEach((column) => {
        this.doc.text(PdfDocument.ellipsize(column.label, column.width - 16, 8, true), x + 8, baseline(this.y + 6, 8), {
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

    this.ensure(headerHeight + rowHeight * Math.min(3, Math.max(rows.length, 1)));
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
        this.doc.text(PdfDocument.ellipsize(cell, column.width - 16, 8.5, isFirst), x + 8, baseline(this.y + 4.5, 8.5), {
          size: 8.5,
          bold: isFirst,
          color: isFirst ? INK : INK_MUTED,
          align: column.align ?? "left",
          width: column.width - 16,
        });
        x += column.width;
      });

      this.y += rowHeight;
    });

    this.y += 22;
  }

  /** Jadval ostidagi "Jami" qatori. Oldingi `table` qo'shgan oraliq bekor qilinadi. */
  private totalsRow(cells: string[], columns: Column[]): void {
    const height = 22;
    this.y -= 18;
    this.ensure(height + 6);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_WIDTH, height, 5, "#eef6fd");

    let x = MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index];
      this.doc.text(PdfDocument.ellipsize(cell, column.width - 16, 8.5, true), x + 8, baseline(this.y + 6.5, 8.5), {
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

  private seriesSection(): void {
    const { series } = this.report;
    const rows = series.rows;
    const hasRows = rows != null && rows.length > 0;
    // Diagramma sarlavha bilan bir sahifada bo'lsin (`chart` ning o'z joy talabi).
    this.sectionTitle(series.title, hasRows ? `${count(rows.length)} qator · kWh` : undefined, hasRows ? 164 : 80);
    if (rows == null) {
      this.emptyNote(NOT_UPLOADED);
      return;
    }
    if (rows.length === 0) {
      this.emptyNote(series.emptyText);
      return;
    }

    this.chart(rows);

    const columns = fitColumns([
      { key: "label", label: series.column, width: 135 },
      { key: "total", label: "Umumiy oqim, kWh", width: 100, align: "right" },
      { key: "useful", label: "Foydali oqim, kWh", width: 100, align: "right" },
      { key: "loss", label: "Yo’qotish, kWh", width: 100, align: "right" },
      { key: "share", label: "Ulush, %", width: 80, align: "right" },
    ]);
    const cells = (row: ReportSeriesRow) => [
      row.label,
      kwh(row.totalKwh),
      kwh(row.usefulKwh),
      kwh(row.lossKwh),
      share(row.lossPercent),
    ];
    this.table(columns, rows.map(cells));
    if (series.totals) this.totalsRow(cells(series.totals), columns);
  }

  private transformersSection(): void {
    const rows = this.report.transformers;
    this.sectionTitle("Transformatorlar", rows && rows.length > 0 ? `${count(rows.length)} TP · kWh` : undefined);
    if (rows == null) {
      this.emptyNote(NOT_UPLOADED);
      return;
    }
    if (rows.length === 0) {
      this.emptyNote("Shu oyda TP yo’q");
      return;
    }
    const district = this.report.scopeKind === "district";
    const columns = fitColumns([
      { key: "name", label: "TP", width: 70 },
      { key: "feeder", label: district ? "Podstansiya · fider" : "Fider", width: 110 },
      { key: "total", label: "Umumiy oqim", width: 75, align: "right" },
      { key: "useful", label: "Foydali oqim", width: 75, align: "right" },
      { key: "loss", label: "Yo’qotish", width: 65, align: "right" },
      { key: "share", label: "Ulush, %", width: 55, align: "right" },
      { key: "subscribers", label: "Abonentlar", width: 65, align: "right" },
    ]);
    this.table(
      columns,
      rows.map((row) => [
        row.name,
        district ? `${row.substation} · ${row.feeder}` : row.feeder,
        kwh(row.totalKwh),
        kwh(row.usefulKwh),
        kwh(row.lossKwh),
        share(row.lossPercent),
        num(row.subscribers),
      ]),
    );
  }

  private violationsSection(): void {
    const section = this.report.violations;
    this.sectionTitle("Qoidabuzarliklar", this.report.monthLabel);
    if (section == null) {
      this.emptyNote(NOT_UPLOADED);
      return;
    }
    const columns = fitColumns([
      { key: "type", label: "Turi", width: 175 },
      { key: "count", label: "Soni", width: 80, align: "right" },
      { key: "uzs", label: "Keltirilgan zarar, so’m", width: 140, align: "right" },
      { key: "kwh", label: "Taxminiy zarar, kWh", width: 120, align: "right" },
    ]);
    const cells = (row: { label: string; count: number; damageUzs: number; damageKwh: number }) => [
      row.label,
      count(row.count),
      num(row.damageUzs),
      num(row.damageKwh),
    ];
    this.table(columns, section.rows.map(cells));
    this.totalsRow(cells(section.total), columns);
  }

  private appealsSection(): void {
    const section = this.report.appeals;
    this.sectionTitle("Murojaatlar", this.report.monthLabel);
    if (section == null) {
      this.emptyNote(NOT_UPLOADED);
      return;
    }
    const columns = fitColumns([
      { key: "status", label: "Holati", width: 315 },
      { key: "count", label: "Soni", width: 200, align: "right" },
    ]);
    this.table(
      columns,
      section.rows.map((row) => [row.label, count(row.count)]),
    );
    this.totalsRow([section.total.label, count(section.total.count)], columns);
  }

  private signatures(): void {
    this.ensure(74);
    const gap = 24;
    const width = (CONTENT_WIDTH - gap) / 2;
    const entries: Array<[string, string]> = [
      ["Mas’ul xodim", this.report.responsible ?? ""],
      ["Tasdiqladi", ""],
    ];

    entries.forEach(([role, name], index) => {
      const x = MARGIN + index * (width + gap);
      this.doc.text(role, x, baseline(this.y, 8), { size: 8, color: INK_SOFT });
      // Imzo chizig'i, ostida F.I.Sh (bo'sh bo'lsa - qo'lda to'ldiriladi).
      this.doc.line(x, this.y + 30, x + width - 40, this.y + 30, "#c8c8cc");
      this.doc.text(name || "F.I.Sh.", x, baseline(this.y + 36, 8), {
        size: 8,
        color: name ? INK : INK_SOFT,
      });
    });

    this.y += 74;
  }

  build(): Buffer {
    this.page = 1;
    this.drawFooter();
    this.header();
    this.summary();
    this.seriesSection();
    this.transformersSection();
    this.violationsSection();
    this.appealsSection();
    this.signatures();
    return this.doc.toBuffer();
  }
}

export function renderReportPdf(report: ScopeReport): Buffer {
  return new ReportLayout(report).build();
}
