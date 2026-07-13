import PDFDocument from "pdfkit";
import { createWriteStream, existsSync } from "fs";
import { join } from "path";
import {
  COMPANY_LOGO_BUNDLED,
  COMPANY_LOGO_PATH,
  COMPANY_LOGO_PIC,
  PAYROLL_UPLOADS_ROOT,
  PROJECT_ROOT,
  findProjectRootLogo,
} from "../config/paths";
import type { Company, SalaryStructure, Employee } from './payslipGenerator'
import { buildPayslipPayrollSummary } from "./payslipGenerator";
import { formatPayslipTitleLabel } from "./payslipDownloadName";
import { formatLeaveBalanceDisplay } from "./payslipEmployeeEnrichment";
import { formatPayslipPersonName } from "../utils/personName";

export type TemplateId = "classic" | "corporate" | "minimal";

const A4_HEIGHT = 841.89;
const A4_WIDTH = 595.28;
const MARGIN = 40;
const MARGIN_BOTTOM = 0;

const PAGE = {
  left: MARGIN,
  right: A4_WIDTH - MARGIN,
  width: A4_WIDTH - 2 * MARGIN,
  top: MARGIN,
  bottom: A4_HEIGHT - MARGIN_BOTTOM,
  height: A4_HEIGHT,
};

/** Space reserved at page bottom: net pay bar + company footer block. */
const LAYOUT = {
  netPayH: 68,
  netPayGapAfterTable: 8,
  footerGap: 20,
  footerBlockH: 44,
  tableHeaderH: 20,
  tableEmptyRowsAfter: 2,
  totalsH: 22,
  minTableRowH: 12,
  maxTableRowH: 18,
  sectionHeaderH: 22,
  dataRowH: 26,
  dataRowHCompact: 22,
  sectionGap: 10,
  cardRadius: 8,
  cardPad: 6,
};

/** Company header row (logo + company details). */
const HEADER = {
  height: 62,
  pad: 10,
  logoColShare: 0.3,
  border: "#cccccc",
  borderWidth: 0.5,
  bg: "#ffffff",
  logoText: "#2d7a5f",
  companyName: "#1a4d3a",
  metaText: "#444444",
  logoFontSize: 11,
  companyNameFontSize: 16,
  metaFontSize: 8,
};

/** Payslip title bar ("Payslip for May 2026"). */
const TITLE_BAR = {
  height: 24,
  bg: "#2f6b4f",
  text: "#ffffff",
  gapBelow: 4,
  fontSize: 10,
};

/** Pay summary row (pay date, working days, etc.). */
const PAY_SUMMARY = {
  bg: "#dff0eb",
  border: "#b2d8cc",
  borderWidth: 0.5,
  divider: "#b7c8bb",
  labelColor: "#85919a",
  labelFontSize: 7.5,
  valueColor: "#144b40",
  valueFontSize: 10,
  padY: 6,
  labelValueGap: 2,
};

/** Employee / Role / Location three-column block. */
const EMP_INFO = {
  headerBg: "#2f6b4f",
  headerText: "#ffffff",
  headerFontSize: 7.5,
  headerH: 16,
  rowH: 14,
  labelW: 62,
  labelBg: "#eaf3ed",
  labelColor: "#0d5e4e",
  labelFontSize: 7,
  valueBg: "#ffffff",
  valueColor: "#313b47",
  valueFontSize: 7,
  border: "#b9c9bf",
  borderWidth: 1,
  outerBorderWidth: 1,
  padX: 5,
  padY: 2,
};

/** Leave balance row (header + values). */
const LEAVE_BALANCE = {
  headerBg: "#2f6b4f",
  headerText: "#ffffff",
  noteBg: "#ffffff",
  noteText: "#85919a",
  valueBg: "#c8e3dc",
  valueText: "#0d5e4e",
  border: "#b9c9bf",
  borderWidth: 1,
  headerH: 22,
  valueH: 26,
};

/** Earnings & deductions side-by-side table. */
const SALARY_TABLE_STYLE = {
  border: "#b7c8bb",
  borderWidth: 0.5,
  sectionHeaderBg: "#2f6b4f",
  sectionHeaderText: "#ffffff",
  sectionHeaderFontSize: 9,
  sectionHeaderH: 22,
  colHeaderBg: "#c8e3dc",
  colHeaderText: "#144b40",
  colHeaderFontSize: 8,
  colHeaderH: 20,
  dataBg: "#ffffff",
  dataRowAlt: "#f4f8f6",
  dataText: "#333333",
  dataFontSize: 8,
  dataRowH: 18,
  totalsBg: "#c8e3dc",
  totalsText: "#0D5E4E",
  totalsFontSize: 11,
  totalsBorderTop: "#0D5E4E",
  totalsBorderTopWidth: 1,
  componentShare: 0.45,
  amountShare: 0.275,
  padX: 6,
  padY: 3,
};

/** Typography scale (matches reference payslip — ~10–11pt body, larger titles). */
const FONTS = {
  companyName: 16,
  companyReg: 8,
  companyAddr: 8,
  titleBar: 12,
  titleMeta: 8.5,
  summaryLabel: 8,
  summaryValue: 11.5,
  sectionHeader: 8.5,
  cellLabel: 8.5,
  cellValue: 10,
  tableHeader: 8.5,
  tableRowMin: 7.5,
  tableRowMid: 8.5,
  tableRowMax: 9.5,
  leaveHeader: 8,
  leaveNote: 7,
  leaveValue: 9.5,
  totals: 9,
  netPayLabel: 8,
  netPayWords: 9,
  netPayTitle: 13,
  netPaySub: 8,
  netPayAmount: 20,
  footerName: 9,
  footerContact: 7.5,
  footerDisclaimer: 7,
};

type FontSet = {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
};

let FONT: FontSet = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldItalic: "Helvetica-BoldOblique",
};

type FontCandidate = {
  family: string;
  files: {
    regular: string;
    bold: string;
    italic: string;
    boldItalic: string;
  };
};

const FONT_CANDIDATES: FontCandidate[] = [
  {
    family: "Inter",
    files: {
      regular: "Inter-Regular.ttf",
      bold: "Inter-Bold.ttf",
      italic: "Inter-Italic.ttf",
      boldItalic: "Inter-BoldItalic.ttf",
    },
  },
  {
    family: "Poppins",
    files: {
      regular: "Poppins-Regular.ttf",
      bold: "Poppins-Bold.ttf",
      italic: "Poppins-Italic.ttf",
      boldItalic: "Poppins-BoldItalic.ttf",
    },
  },
  {
    family: "Roboto",
    files: {
      regular: "Roboto-Regular.ttf",
      bold: "Roboto-Bold.ttf",
      italic: "Roboto-Italic.ttf",
      boldItalic: "Roboto-BoldItalic.ttf",
    },
  },
];

function resolveFontFiles() {
  const searchDirs = [
    join(PROJECT_ROOT, "fonts"),
    join(PROJECT_ROOT, "public", "fonts"),
    join(PROJECT_ROOT, "frontend", "public", "fonts"),
    join(PROJECT_ROOT, "assets", "fonts"),
    join(PAYROLL_UPLOADS_ROOT, "template", "fonts"),
  ];

  for (const candidate of FONT_CANDIDATES) {
    for (const dir of searchDirs) {
      const regular = join(dir, candidate.files.regular);
      const bold = join(dir, candidate.files.bold);
      const italic = join(dir, candidate.files.italic);
      const boldItalic = join(dir, candidate.files.boldItalic);
      if (
        existsSync(regular) &&
        existsSync(bold) &&
        existsSync(italic) &&
        existsSync(boldItalic)
      ) {
        return { family: candidate.family, regular, bold, italic, boldItalic };
      }
    }
  }

  return null;
}

function registerPayslipFonts(doc: InstanceType<typeof PDFDocument>): FontSet {
  const resolved = resolveFontFiles();
  if (!resolved) return FONT;

  const familyKey = `Payslip-${resolved.family}`;
  doc.registerFont(`${familyKey}-Regular`, resolved.regular);
  doc.registerFont(`${familyKey}-Bold`, resolved.bold);
  doc.registerFont(`${familyKey}-Italic`, resolved.italic);
  doc.registerFont(`${familyKey}-BoldItalic`, resolved.boldItalic);
  return {
    regular: `${familyKey}-Regular`,
    bold: `${familyKey}-Bold`,
    italic: `${familyKey}-Italic`,
    boldItalic: `${familyKey}-BoldItalic`,
  };
}

function bottomReservedHeight(): number {
  return LAYOUT.netPayH + LAYOUT.netPayGapAfterTable + footerBlockHeight() + LAYOUT.footerGap + 4;
}

/** Y below which salary table rows must not draw (net pay band + footer). */
function contentZoneTop(): number {
  return PAGE.bottom - bottomReservedHeight();
}

function formatGeneratedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function drawCard(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.save();
  doc
    .roundedRect(x, y, w, h, LAYOUT.cardRadius)
    .fill(COLORS.white)
    .stroke(COLORS.borderLight);
  doc.restore();
}

function drawChip(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  text: string,
  opts?: { fontSize?: number; padX?: number; padY?: number },
): number {
  const fontSize = opts?.fontSize ?? 8.5;
  const padX = opts?.padX ?? 8;
  const padY = opts?.padY ?? 3;
  doc.font(FONT.bold).fontSize(fontSize);
  const textW = doc.widthOfString(text);
  const chipW = textW + padX * 2;
  const chipH = fontSize + padY * 2;
  doc.roundedRect(x, y, chipW, chipH, chipH / 2).fill(COLORS.chipBg);
  doc.fillColor(COLORS.chipText).text(text, x + padX, y + padY - 1, {
    width: chipW - padX * 2,
    align: "center",
  });
  doc.fillColor(COLORS.text);
  return chipW;
}

function drawIconBadge(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  size: number,
  text: string,
): void {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill(COLORS.primary);
  doc
    .fillColor(COLORS.white)
    .font(FONT.bold)
    .fontSize(Math.max(6, size - 6))
    .text(text, x, y + 1, { width: size, align: "center" });
  doc.restore();
}

function drawSectionHeader(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  iconText: string,
): void {
  doc.rect(x, y, w, h).fill(COLORS.sectionHeaderBg).stroke(COLORS.borderLight);
  const iconSize = 12;
  const iconX = x + 8;
  const iconY = y + (h - iconSize) / 2;
  drawIconBadge(doc, iconX, iconY, iconSize, iconText);
  doc
    .fillColor(COLORS.sectionHeaderText)
    .fontSize(FONTS.sectionHeader)
    .font(FONT.bold)
    .text(title, iconX + iconSize + 6, y + (h - FONTS.sectionHeader) / 2 - 1, {
      width: w - iconSize - 18,
      align: "left",
    });
  doc.fillColor(COLORS.valueBold);
}

function drawSummaryCell(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
): void {
  doc.rect(x, y, w, h).fill(COLORS.summaryBarBg).stroke(COLORS.borderLight);
  doc
    .fontSize(FONTS.summaryLabel)
    .fillColor(COLORS.labelText)
    .font(FONT.bold)
    .text(label, x + 10, y + 6, { width: w - 20, align: "left" });
  doc
    .fontSize(FONTS.summaryValue)
    .fillColor(COLORS.valueBold)
    .font(FONT.bold)
    .text(value, x + 10, y + 20, { width: w - 20, align: "left" });
  doc.fillColor(COLORS.valueBold);
}

/** Company footer — fixed to page bottom. */
function drawCompanyFooter(
  doc: InstanceType<typeof PDFDocument>,
  company: Company,
): void {
  const companyName = safe(company["Company Name"], "Epical Layouts Pvt Ltd");
  const regLine = [
    `GSTIN: ${safe(company["GSTIN"])}`,
    `PAN: ${safe(company["Company PAN"])}`,
    `Email: ${safe(company["Email"])}`,
  ].join(" | ");
  const addressLine = [
    company["Address Line 1"],
    company["Address Line 2"],
    company["City"],
    company["State"],
    company["PIN"],
  ]
    .map((part) => safe(part))
    .filter(Boolean)
    .join(" ");
  const phone = safe(company["Phone"]);
  const website = safe(company["Website"]);
  const contactParts = [
    phone ? `Phone: ${phone}` : "",
    website ? `Website: ${website}` : "",
  ].filter(Boolean);

  const metaLines: { text: string; italic?: boolean }[] = [{ text: regLine }];
  if (addressLine) metaLines.push({ text: addressLine });
  if (contactParts.length) metaLines.push({ text: contactParts.join(" | ") });
  metaLines.push({
    text: "This is a computer-generated payslip and does not require a physical signature.",
    italic: true,
  });

  const h = footerBlockHeight(metaLines.length, true);
  const top = PAGE.bottom - h - LAYOUT.footerGap;

  doc.fillColor(FOOTER.bg);
  doc.rect(PAGE.left, top, PAGE.width, h).fill();

  doc.save();
  doc.strokeColor(FOOTER.border).lineWidth(FOOTER.borderWidth);
  doc.moveTo(PAGE.left, top).lineTo(PAGE.right, top).stroke();
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);

  let y = top + FOOTER.padY + FOOTER.borderWidth;
  doc
    .fontSize(FOOTER.nameSize)
    .fillColor(FOOTER.nameColor)
    .font(FONT.bold)
    .text(companyName, PAGE.left, y, {
      width: PAGE.width,
      align: "center",
      lineBreak: false,
      lineGap: 0,
    });
  y += FOOTER.nameSize + FOOTER.lineGap;

  for (const line of metaLines) {
    doc
      .fontSize(FOOTER.metaSize)
      .fillColor(FOOTER.metaColor)
      .font(line.italic ? FONT.italic : FONT.regular)
      .text(line.text, PAGE.left, y, {
        width: PAGE.width,
        align: "center",
        lineBreak: false,
        lineGap: 0,
        ellipsis: !line.italic,
      });
    y += FOOTER.metaSize + FOOTER.lineGap;
  }

  doc.fillColor(COLORS.valueBold);
}

/** Fit data + spacer rows in the band above totals and the fixed bottom block. */
/** Default earnings row count in payroll master template (spare rows fill before table grows). */
const PAYSLIP_EARNINGS_BASELINE_ROWS = 9
/** PT, TDS, LOP Deduction, Loan Recovery */
const PAYSLIP_DEDUCTIONS_BASELINE_ROWS = 4

function calcTableBodyRowCount(dataRows: number, baseline: number): number {
  const spareUsed = Math.max(0, dataRows - baseline)
  const spareRows = Math.max(0, LAYOUT.tableEmptyRowsAfter - spareUsed)
  return dataRows + spareRows
}

function calcTableRowHeight(
  yTableStart: number,
  bodyRowCount: number,
  headerBandH: number,
): number {
  const bodyRows = bodyRowCount
  if (bodyRows <= 0) return SALARY_TABLE_STYLE.dataRowH;
  const available =
    contentZoneTop() - yTableStart - headerBandH - LAYOUT.totalsH;
  if (available <= 0) return LAYOUT.minTableRowH;
  const ideal = available / bodyRows;
  return Math.max(
    LAYOUT.minTableRowH,
    Math.min(SALARY_TABLE_STYLE.dataRowH, ideal),
  );
}

type SalaryTableRow = {
  earn?: { name: string; earned: number; ytd: number };
  ded?: { name: string; month: number; ytd: number };
};

/** One earnings/deductions grid row (data or empty spacer). */
function drawSalaryTableRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  rowH: number,
  rowIndex: number,
  geom: {
    earnLeft: number;
    dedLeft: number;
    nameCol: number;
    amtCol: number;
    ytdCol: number;
  },
  row: SalaryTableRow,
): void {
  const { earnLeft, dedLeft, nameCol, amtCol, ytdCol } = geom;
  const fill =
    rowIndex % 2 === 0 ? SALARY_TABLE_STYLE.dataBg : SALARY_TABLE_STYLE.dataRowAlt;
  const nameOpts = {
    fontSize: SALARY_TABLE_STYLE.dataFontSize,
    minFontSize: 5.5,
    color: SALARY_TABLE_STYLE.dataText,
    bold: false,
    padX: SALARY_TABLE_STYLE.padX,
    padY: SALARY_TABLE_STYLE.padY,
    align: "left" as const,
  };
  const amtOpts = {
    ...nameOpts,
    align: "right" as const,
  };

  const er = row.earn;
  let x = earnLeft;
  doc.rect(x, y, nameCol, rowH).fill(fill);
  if (er) drawCellText(doc, er.name, x, y, nameCol, rowH, nameOpts);
  x += nameCol;
  doc.rect(x, y, amtCol, rowH).fill(fill);
  if (er) drawCellText(doc, formatAmount(er.earned), x, y, amtCol, rowH, amtOpts);
  x += amtCol;
  doc.rect(x, y, ytdCol, rowH).fill(fill);
  if (er) drawCellText(doc, formatAmount(er.ytd), x, y, ytdCol, rowH, amtOpts);

  const dr = row.ded;
  x = dedLeft;
  doc.rect(x, y, nameCol, rowH).fill(fill);
  if (dr) drawCellText(doc, dr.name, x, y, nameCol, rowH, nameOpts);
  x += nameCol;
  doc.rect(x, y, amtCol, rowH).fill(fill);
  if (dr) drawCellText(doc, formatAmount(dr.month), x, y, amtCol, rowH, amtOpts);
  x += amtCol;
  doc.rect(x, y, ytdCol, rowH).fill(fill);
  if (dr) drawCellText(doc, formatAmount(dr.ytd), x, y, ytdCol, rowH, amtOpts);
}

function drawSalaryTableGrid(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  top: number,
  width: number,
  height: number,
  halfW: number,
  geom: { nameCol: number; amtCol: number; ytdCol: number },
  rowYs: number[],
): void {
  const { nameCol, amtCol, ytdCol } = geom;
  const dedLeft = left + halfW;
  doc.save();
  doc.lineWidth(SALARY_TABLE_STYLE.borderWidth).strokeColor(SALARY_TABLE_STYLE.border);
  doc.rect(left, top, width, height).stroke();
  doc.moveTo(dedLeft, top).lineTo(dedLeft, top + height).stroke();
  for (const sideLeft of [left, dedLeft]) {
    doc.moveTo(sideLeft + nameCol, top).lineTo(sideLeft + nameCol, top + height).stroke();
    doc
      .moveTo(sideLeft + nameCol + amtCol, top)
      .lineTo(sideLeft + nameCol + amtCol, top + height)
      .stroke();
  }
  for (const rowY of rowYs) {
    doc.moveTo(left, rowY).lineTo(left + width, rowY).stroke();
  }
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);
}

/** Net pay bar — placed directly below salary table; footer fixed at page bottom. */
function drawBottomBand(
  doc: InstanceType<typeof PDFDocument>,
  netPay: number,
  company: Company,
  compactLayout: boolean,
  bandY: number,
): void {
  const y = bandY;
  const netH = LAYOUT.netPayH;
  const leftW = PAGE.width * NET_PAY.leftShare;
  const midW = PAGE.width * NET_PAY.midShare;
  const rightW = PAGE.width - leftW - midW;
  const midX = PAGE.left + leftW;
  const rightX = midX + midW;
  const pad = NET_PAY.pad;
  const wordsText = `Indian Rupees ${numToIndianWords(netPay)} Only`;
  const amountText = `Rs. ${formatAmount(netPay)}`;

  doc.rect(PAGE.left, y, leftW, netH).fill(NET_PAY.wordsBg);
  doc.rect(midX, y, midW, netH).fill(NET_PAY.labelBg);
  doc.rect(rightX, y, rightW, netH).fill(NET_PAY.amountBg);

  doc
    .fontSize(NET_PAY.wordsLabelSize)
    .fillColor(NET_PAY.wordsLabel)
    .font(FONT.bold)
    .text("AMOUNT IN WORDS", PAGE.left + pad, y + pad, {
      width: leftW - pad * 2,
      align: "left",
      lineBreak: false,
    });
  doc
    .fontSize(compactLayout ? 9 : NET_PAY.wordsValueSize)
    .fillColor(NET_PAY.wordsValue)
    .font(FONT.boldItalic)
    .text(wordsText, PAGE.left + pad, y + pad + NET_PAY.wordsLabelSize + 3, {
      width: leftW - pad * 2,
      align: "left",
      lineGap: 0,
    });

  const labelBlockH = NET_PAY.labelTitleSize + 4 + NET_PAY.labelSubSize;
  const labelY = y + (netH - labelBlockH) / 2 - 1;
  doc
    .fontSize(compactLayout ? 10 : NET_PAY.labelTitleSize)
    .fillColor(NET_PAY.labelText)
    .font(FONT.bold)
    .text("NET PAY", midX, labelY, {
      width: midW,
      align: "center",
      lineBreak: false,
    });
  doc
    .fontSize(NET_PAY.labelSubSize)
    .fillColor(NET_PAY.labelText)
    .font(FONT.regular)
    .text("(Take Home / In-hand)", midX, labelY + NET_PAY.labelTitleSize + 2, {
      width: midW,
      align: "center",
      lineBreak: false,
    });

  const amtFs = compactLayout ? 14 : NET_PAY.amountSize;
  doc
    .fontSize(amtFs)
    .fillColor(NET_PAY.amountText)
    .font(FONT.bold)
    .text(amountText, rightX, y + (netH - amtFs) / 2 - 1, {
      width: rightW,
      align: "center",
      lineBreak: false,
    });

  doc.save();
  doc.lineWidth(NET_PAY.borderWidth).strokeColor(NET_PAY.border);
  doc.rect(PAGE.left, y, PAGE.width, netH).stroke();
  doc.moveTo(midX, y).lineTo(midX, y + netH).stroke();
  doc.moveTo(rightX, y).lineTo(rightX, y + netH).stroke();
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);

  doc.fillColor(COLORS.valueBold);
  drawCompanyFooter(doc, company);
}

function tableFontSize(rowH: number): number {
  const maxByHeight = Math.max(5.5, rowH - 4);
  let preferred = FONTS.tableRowMax;
  if (rowH <= 14) preferred = FONTS.tableRowMin;
  else if (rowH <= 17) preferred = FONTS.tableRowMid;
  return Math.min(maxByHeight, preferred);
}

/** Net pay bottom band (amount in words | label | amount). */
const NET_PAY = {
  border: "#b7c8bb",
  borderWidth: 0.5,
  leftShare: 0.4,
  midShare: 0.25,
  pad: 8,
  wordsBg: "#ffffff",
  wordsLabel: "#6b7180",
  wordsLabelSize: 7.5,
  wordsValue: "#094136",
  wordsValueSize: 10,
  labelBg: "#2f6b4f",
  labelText: "#ffffff",
  labelTitleSize: 11,
  labelSubSize: 8,
  amountBg: "#c8e3dc",
  amountText: "#144b40",
  amountSize: 18,
};

/** Company footer fixed to page bottom. */
const FOOTER = {
  bg: "#ffffff",
  border: "#b7c8bb",
  borderWidth: 1,
  padY: 6,
  nameColor: "#144b40",
  nameSize: 8,
  metaColor: "#555555",
  metaSize: 6,
  lineGap: 2,
};

/** Company slogan — single line beneath company name in header. */
const COMPANY_SLOGAN = {
  text: ' "Precision in every micron, Innovation in every design" ',
  fontSize: 8,
  gapAfterName: 2,
  textColor: "#666666",
};

function measureCompanySloganHeight(
  doc: InstanceType<typeof PDFDocument>,
  regionWidth: number,
): number {
  doc.save();
  doc.font(FONT.italic).fontSize(COMPANY_SLOGAN.fontSize);
  const h = doc.heightOfString(COMPANY_SLOGAN.text, { width: regionWidth, lineBreak: false });
  doc.restore();
  return h;
}

function drawCompanySlogan(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  regionX: number,
  regionWidth: number,
): number {
  const s = COMPANY_SLOGAN;
  doc.font(FONT.italic).fontSize(s.fontSize).fillColor(s.textColor);
  doc.text(s.text, regionX, y, {
    width: regionWidth,
    align: "center",
    lineBreak: false,
    lineGap: 0,
  });
  return measureCompanySloganHeight(doc, regionWidth);
}

function footerBlockHeight(metaLineCount = 4, includeName = true): number {
  const nameLines = includeName ? 1 : 0;
  const totalLines = nameLines + metaLineCount;
  return (
    FOOTER.padY * 2 +
    FOOTER.borderWidth +
    FOOTER.lineGap * Math.max(0, totalLines - 1) +
    FOOTER.nameSize * nameLines +
    FOOTER.metaSize * metaLineCount +
    2
  );
}

/** Side-by-side earnings / deductions column layout (50% each, 45/27.5/27.5). */
const SALARY_TABLE = {
  cellPadX: 6,
  cellPadY: 3,
};

function calcSalaryTableColumns(contentWidth: number) {
  const halfW = contentWidth / 2;
  const nameCol = Math.floor(halfW * SALARY_TABLE_STYLE.componentShare);
  const amtCol = Math.floor(halfW * SALARY_TABLE_STYLE.amountShare);
  const ytdCol = halfW - nameCol - amtCol;
  return {
    halfW,
    earnW: halfW,
    dedW: halfW,
    nameCol,
    amtCol,
    ytdCol,
    nameColEarn: nameCol,
    amtColEarn: amtCol,
    nameColDed: nameCol,
    amtColDed: amtCol,
  };
}

function fitFontSize(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  maxWidth: number,
  preferred: number,
  min: number,
  fontName: string,
): number {
  let fs = preferred;
  doc.font(fontName);
  while (fs > min) {
    doc.fontSize(fs);
    if (doc.widthOfString(text) <= maxWidth) return fs;
    fs -= 0.5;
  }
  return min;
}

type LabelValuePair = { label: string; value: string };

function measureWrappedTextHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  fontName: string,
  fontSize: number,
  innerW: number,
): number {
  if (!text) return fontSize;
  doc.font(fontName).fontSize(fontSize);
  return doc.heightOfString(text, { width: Math.max(1, innerW), lineGap: 0 });
}

/** Uniform row height + label width so no cell text is clipped in a label/value table. */
function measureUniformLabelValueTableLayout(
  doc: InstanceType<typeof PDFDocument>,
  cells: LabelValuePair[],
  colW: number,
  baseLabelW: number,
  baseRowH: number,
  opts?: { maxLabelShare?: number; fixedLabelW?: number },
): { rowH: number; labelW: number } {
  const fontSize = EMP_INFO.labelFontSize;
  const padX = EMP_INFO.padX;
  const padY = EMP_INFO.padY;
  const maxLabelW = Math.floor(colW * (opts?.maxLabelShare ?? 0.48));

  doc.font(FONT.bold).fontSize(fontSize);
  let labelW = opts?.fixedLabelW ?? baseLabelW;
  if (opts?.fixedLabelW === undefined) {
    for (const cell of cells) {
      const singleLineW = doc.widthOfString(cell.label) + padX * 2;
      labelW = Math.max(labelW, Math.min(Math.ceil(singleLineW), maxLabelW));
    }
  }

  let rowH = baseRowH;
  for (const cell of cells) {
    const labelInnerW = Math.max(1, labelW - padX * 2);
    const valueInnerW = Math.max(1, colW - labelW - padX * 2);
    const labelTextH = measureWrappedTextHeight(doc, cell.label, FONT.bold, fontSize, labelInnerW);
    const valueTextH = measureWrappedTextHeight(
      doc,
      cell.value,
      FONT.regular,
      fontSize,
      valueInnerW,
    );
    const cellH = padY * 2 + Math.max(labelTextH, valueTextH);
    rowH = Math.max(rowH, Math.ceil(cellH));
  }

  return {
    rowH: Math.max(rowH, baseRowH),
    labelW,
  };
}

function drawUniformLabelValueGrid(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  dataTop: number,
  colWs: number[],
  rowH: number,
  labelW: number,
  rows: LabelValuePair[][],
  cellOpts?: { style?: "default" | "empInfo"; uniformText?: boolean },
): void {
  let y = dataTop;
  for (const row of rows) {
    let x = left;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const colW = colWs[c] ?? colWs[colWs.length - 1];
      drawLabelValueCell(doc, x, y, colW, rowH, cell.label, cell.value, labelW, cellOpts);
      x += colW;
    }
    y += rowH;
  }
}

/** Draw text inside a cell with clip + auto-shrink so it never bleeds into neighbors. */
function drawCellText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fontSize: number;
    minFontSize?: number;
    align?: "left" | "right" | "center";
    color?: string;
    bold?: boolean;
    padX?: number;
    padY?: number;
    noShrink?: boolean;
    wrap?: boolean;
  },
): void {
  if (!text) return;
  const padX = opts.padX ?? SALARY_TABLE.cellPadX;
  const padY = opts.padY ?? SALARY_TABLE.cellPadY;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padY * 2);
  const fontName = opts.bold ? FONT.bold : FONT.regular;
  const minFs = opts.minFontSize ?? 5.5;
  let fs: number;
  if (opts.noShrink) {
    fs = Math.min(opts.fontSize, Math.max(minFs, innerH - 1));
  } else {
    fs = fitFontSize(doc, text, innerW, opts.fontSize, minFs, fontName);
    fs = Math.min(fs, Math.max(minFs, innerH - 2));
  }

  doc.save();
  doc.rect(x, y, w, h).clip();
  doc
    .fillColor(opts.color ?? COLORS.valueBold)
    .font(fontName)
    .fontSize(fs);
  const wrap = opts.wrap === true;
  const textBlockH = wrap
    ? doc.heightOfString(text, { width: innerW, lineGap: 0 })
    : fs;
  const textY = y + padY + Math.max(0, (innerH - textBlockH) / 2) - (wrap ? 0 : 1);
  doc.text(text, x + padX, textY, {
    width: innerW,
    align: opts.align ?? "left",
    lineBreak: wrap,
    ellipsis: !wrap,
  });
  doc.restore();
}

const COLORS = {
  sectionHeaderBg: "#2f6b4f",
  sectionHeaderText: "#ffffff",
  labelText: "#4a7c59",
  valueBold: "#1a4d2e",
  tableHeaderBg: "#e8f5e9",
  tableHeaderText: "#1a4d2e",
  totalsRowBg: "#c8e6c9",
  border: "#b2dfdb",
  borderLight: "#b2dfdb",
  netPayBg: "#2f6b4f",
  netPayText: "#ffffff",
  amountWordsBg: "#f1f8f2",
  white: "#ffffff",
  rowAlt: "#f1f8f2",
  labelBg: "#ffffff",
  summaryBarBg: "#e8f5e9",
  leaveValueBg: "#f1f8f2",
  chipBg: "#e8f5e9",
  chipText: "#1a4d2e",
  /** @deprecated use sectionHeaderBg / valueBold */
  primary: "#1a4d2e",
  /** @deprecated use valueBold */
  primaryDark: "#1a4d2e",
  /** @deprecated use totalsRowBg */
  primaryLight: "#c8e6c9",
  /** @deprecated use amountWordsBg */
  primaryTint: "#f1f8f2",
  /** @deprecated use labelText */
  muted: "#4a7c59",
  /** @deprecated use valueBold */
  text: "#1a4d2e",
};

function formatAmount(v: unknown): string {
  try {
    const num = parseFloat(String(v));
    if (Number.isNaN(num)) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return "0.00";
  }
}

function formatCurrency(v: unknown): string {
  return `₹${formatAmount(v)}`;
}

function safe(v: unknown, defaultVal = ""): string {
  if (v === null || v === undefined) return defaultVal;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = String(v.getUTCDate()).padStart(2, "0");
    return `${day}-${months[v.getUTCMonth()]}-${v.getUTCFullYear()}`;
  }
  return String(v);
}

function parseAmount(v: unknown): number {
  try {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

function numToIndianWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return "Zero";
  const units = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function two(num: number): string {
    if (num < 20) return units[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + units[num % 10] : "");
  }

  function three(num: number): string {
    if (num >= 100) {
      return (
        units[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 ? " " + two(num % 100) : "")
      );
    }
    return two(num);
  }

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;
  const out: string[] = [];
  if (crore) out.push(three(crore) + " Crore");
  if (lakh) out.push(three(lakh) + " Lakh");
  if (thousand) out.push(three(thousand) + " Thousand");
  if (rest) out.push(three(rest));
  return out.join(" ").trim();
}

function drawPayslipTitleBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  payMonth: string,
): number {
  const h = TITLE_BAR.height;
  doc.rect(x, y, w, h).fill(TITLE_BAR.bg);

  const title = formatPayslipTitleLabel(payMonth);
  const ty = y + (h - TITLE_BAR.fontSize) / 2 - 1;

  doc
    .fillColor(TITLE_BAR.text)
    .font(FONT.bold)
    .fontSize(TITLE_BAR.fontSize)
    .text(title, x, ty, { width: w, align: "center", lineBreak: false });

  doc.fillColor(COLORS.valueBold);
  return y + h;
}

function paySummaryBarHeight(): number {
  return (
    PAY_SUMMARY.padY * 2 +
    PAY_SUMMARY.labelFontSize +
    PAY_SUMMARY.labelValueGap +
    PAY_SUMMARY.valueFontSize +
    2
  );
}

function drawPaySummaryBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  items: { label: string; value: string }[],
): number {
  const barH = paySummaryBarHeight();
  const colW = w / items.length;

  doc.fillColor(PAY_SUMMARY.bg);
  doc.rect(x, y, w, barH).fill();
  doc.save();
  doc.lineWidth(PAY_SUMMARY.borderWidth).strokeColor(PAY_SUMMARY.border);
  doc.rect(x, y, w, barH).stroke();
  doc.strokeColor(PAY_SUMMARY.divider);
  for (let i = 1; i < items.length; i++) {
    const divX = x + i * colW;
    doc.moveTo(divX, y).lineTo(divX, y + barH).stroke();
  }
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);

  items.forEach((item, i) => {
    const colX = x + i * colW;
    const labelY = y + PAY_SUMMARY.padY;
    doc
      .fontSize(PAY_SUMMARY.labelFontSize)
      .fillColor(PAY_SUMMARY.labelColor)
      .font(FONT.regular)
      .text(item.label.toUpperCase(), colX, labelY, {
        width: colW,
        align: "center",
        lineBreak: false,
      });
    const valueY = labelY + PAY_SUMMARY.labelFontSize + PAY_SUMMARY.labelValueGap;
    doc
      .fontSize(PAY_SUMMARY.valueFontSize)
      .fillColor(PAY_SUMMARY.valueColor)
      .font(FONT.bold)
      .text(item.value, colX, valueY, {
        width: colW,
        align: "center",
        lineBreak: false,
      });
  });

  doc.fillColor(COLORS.valueBold);
  return y + barH;
}

function drawFilledBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  text: string,
  opts?: { fontSize?: number; align?: "left" | "center" },
): number {
  doc.rect(x, y, w, h).fill(fill);
  doc
    .fillColor(COLORS.sectionHeaderText)
    .fontSize(opts?.fontSize ?? FONTS.titleBar)
    .font(FONT.bold)
    .text(text, x + 6, y + (h - (opts?.fontSize ?? FONTS.titleBar)) / 2 - 1, {
      width: w - 12,
      align: opts?.align ?? "center",
    });
  doc.fillColor(COLORS.valueBold);
  return y + h;
}

function drawLabelValueCell(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  labelW: number,
  opts?: {
    valueAlign?: "left" | "right" | "center";
    valueChip?: boolean;
    style?: "default" | "empInfo";
    uniformText?: boolean;
  },
): void {
  const empStyle = opts?.style === "empInfo";
  const uniformText = opts?.uniformText === true;
  const border = empStyle ? EMP_INFO.border : COLORS.borderLight;
  const borderWidth = empStyle ? EMP_INFO.borderWidth : 1;
  const cellPadX = empStyle ? EMP_INFO.padX : SALARY_TABLE.cellPadX;
  const cellPadY = empStyle ? EMP_INFO.padY : SALARY_TABLE.cellPadY;
  const labelFontSize = empStyle ? EMP_INFO.labelFontSize : FONTS.cellLabel;
  const valueFontSize = empStyle ? EMP_INFO.valueFontSize : FONTS.cellValue;
  const textOpts = uniformText ? { noShrink: true as const, wrap: true as const } : {};

  doc.save();
  doc.lineWidth(borderWidth).strokeColor(border);
  doc
    .rect(x, y, labelW, h)
    .fill(empStyle ? EMP_INFO.labelBg : COLORS.labelBg)
    .stroke();
  drawCellText(doc, label, x, y, labelW, h, {
    fontSize: labelFontSize,
    minFontSize: labelFontSize,
    color: empStyle ? EMP_INFO.labelColor : COLORS.labelText,
    bold: true,
    padX: cellPadX,
    padY: cellPadY,
    ...textOpts,
  });

  if (opts?.valueChip) {
    const chipPadX = 6;
    const chipPadY = 3;
    doc.font(FONT.bold).fontSize(FONTS.cellValue);
    const chipTextW = doc.widthOfString(value || "—");
    const chipH = FONTS.cellValue + chipPadY * 2;
    const chipW = chipTextW + chipPadX * 2;
    const chipX = x + labelW + 6;
    const chipY = y + (h - chipH) / 2;
    doc
      .roundedRect(chipX, chipY, chipW, chipH, chipH / 2)
      .fill(COLORS.chipBg);
    doc
      .fillColor(COLORS.valueBold)
      .text(value || "—", chipX + chipPadX, chipY + chipPadY - 1, {
        width: chipW - chipPadX * 2,
        align: "center",
      });
    doc.restore();
    doc.strokeColor(COLORS.borderLight).lineWidth(1);
    doc.fillColor(COLORS.valueBold);
    return;
  }

  const valueW = w - labelW;
  doc
    .rect(x + labelW, y, valueW, h)
    .fill(empStyle ? EMP_INFO.valueBg : COLORS.white)
    .stroke();
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);

  drawCellText(doc, value, x + labelW, y, valueW, h, {
    fontSize: valueFontSize,
    minFontSize: valueFontSize,
    color: empStyle ? EMP_INFO.valueColor : COLORS.valueBold,
    align: opts?.valueAlign ?? "left",
    bold: !empStyle,
    padX: cellPadX,
    padY: cellPadY,
    ...textOpts,
  });
}

function drawInfoTableGrid(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  top: number,
  width: number,
  height: number,
  opts: {
    fullHeightColumnXs?: number[];
    dataAreaTop: number;
    dataAreaColumnXs?: number[];
    dataAreaLabelDividerXs?: number[];
    rowYs?: number[];
  },
): void {
  const dataBottom = top + height;
  doc.save();
  doc.lineWidth(EMP_INFO.outerBorderWidth).strokeColor(EMP_INFO.border);
  doc.rect(left, top, width, height).stroke();
  for (const x of opts.fullHeightColumnXs ?? []) {
    doc.moveTo(x, top).lineTo(x, dataBottom).stroke();
  }
  for (const rowY of opts.rowYs ?? []) {
    doc.moveTo(left, rowY).lineTo(left + width, rowY).stroke();
  }
  for (const x of opts.dataAreaColumnXs ?? []) {
    doc.moveTo(x, opts.dataAreaTop).lineTo(x, dataBottom).stroke();
  }
  for (const x of opts.dataAreaLabelDividerXs ?? []) {
    doc.moveTo(x, opts.dataAreaTop).lineTo(x, dataBottom).stroke();
  }
  doc.restore();
  doc.strokeColor(COLORS.borderLight).lineWidth(1);
}

/** Mask account number — show last 4 digits only (e.g. XXXXXXXX5678). */
function maskAccountNumber(value: unknown): string {
  const raw = safe(value).replace(/\s/g, "");
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return raw;
  const maskLen = Math.min(Math.max(digits.length - 4, 4), 10);
  return `${"X".repeat(maskLen)}${digits.slice(-4)}`;
}

function formatIfscAndMode(emp: Employee): string {
  const ifscOnly = safe(emp["IFSC"]);
  const payMode = safe(emp["Payment Mode"], safe(emp["Pay Mode"], "NEFT"));
  const combined = safe(emp["IFSC / Mode"]);
  if (ifscOnly) {
    return payMode ? `${ifscOnly} / ${payMode}` : ifscOnly;
  }
  if (!combined) return payMode;
  const parts = combined.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} / ${parts.slice(1).join(" ")}`;
  }
  return combined;
}

export function resolveLogoPath(company: Company = {}): string | null {
  const rootLogo = findProjectRootLogo();
  const candidates = [
    company["Logo Path"],
    company["Logo"],
    COMPANY_LOGO_PATH,
    COMPANY_LOGO_PIC,
    rootLogo,
    join(PAYROLL_UPLOADS_ROOT, "template", "company_logo.jpg"),
    join(PAYROLL_UPLOADS_ROOT, "template", "company_logo.png"),
    join(PAYROLL_UPLOADS_ROOT, "template", "company_logo.webp"),
    COMPANY_LOGO_BUNDLED,
  ];
  for (const c of candidates) {
    const p = safe(c).trim();
    if (p && existsSync(p)) return p;
  }
  return null;
}

export async function savePayslipAsPdf(
  company: Company,
  structure: SalaryStructure,
  emp: Employee,
  outputPath: string,
  _templateId: TemplateId = "classic",
): Promise<void> {
  const payMonth = safe(company["Pay Month"]);
  const payDate = safe(company["Pay Date"]);
  const companyName = safe(company["Company Name"], "Epical Layouts Pvt Ltd");

  const payroll = buildPayslipPayrollSummary(emp, structure, company);
  const { gross, grossYtd, totalDeductions, totalDedYtd, netPay, lopDays, paidDays, workingDays } =
    payroll;

  const earningRows = payroll.earnings.map((e) => ({
    name: e.name,
    earned: e.month,
    ytd: e.ytd,
  }));
  const deductionRows = payroll.deductions.map((d) => ({
    name: d.name,
    month: d.month,
    ytd: d.ytd,
  }));

  const earnBodyRows = calcTableBodyRowCount(
    earningRows.length,
    PAYSLIP_EARNINGS_BASELINE_ROWS,
  );
  const dedBodyRows = calcTableBodyRowCount(
    deductionRows.length,
    PAYSLIP_DEDUCTIONS_BASELINE_ROWS,
  );
  const totalBodyRows = Math.max(earnBodyRows, dedBodyRows);
  const compactLayout = totalBodyRows > 10;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN_BOTTOM, left: MARGIN, right: MARGIN },
    });
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    let y = PAGE.top;

    // ── Header: two-column logo + company row ───────────────────────────────
    const logoPath = resolveLogoPath(company);
    const headerTop = y;
    const headerH = HEADER.height;
    const logoColW = Math.floor(PAGE.width * HEADER.logoColShare);
    const infoColW = PAGE.width - logoColW;
    const infoX = PAGE.left + logoColW;
    const pad = HEADER.pad;
    const logoAreaX = PAGE.left + pad;
    const logoAreaW = logoColW - pad * 2;
    const logoAreaY = headerTop + pad;
    const logoAreaH = headerH - pad * 2;

    doc.fillColor(HEADER.bg);
    doc.rect(PAGE.left, headerTop, PAGE.width, headerH).fill();
    doc.save();
    doc.lineWidth(HEADER.borderWidth).strokeColor(HEADER.border);
    doc.rect(PAGE.left, headerTop, PAGE.width, headerH).stroke();
    doc.moveTo(infoX, headerTop).lineTo(infoX, headerTop + headerH).stroke();
    doc.restore();
    doc.strokeColor(COLORS.borderLight).lineWidth(1);

    if (logoPath) {
      try {
        doc.image(logoPath, logoAreaX, logoAreaY, {
          fit: [logoAreaW, logoAreaH],
          align: "center",
          valign: "center",
        });
      } catch {
        doc.font(FONT.regular).fontSize(HEADER.logoFontSize);
        const logoTextH = doc.heightOfString("[ LOGO ]", { width: logoAreaW });
        doc
          .fillColor(HEADER.logoText)
          .text("[ LOGO ]", logoAreaX, logoAreaY + (logoAreaH - logoTextH) / 2, {
            width: logoAreaW,
            align: "center",
          });
      }
    } else {
      doc.font(FONT.regular).fontSize(HEADER.logoFontSize);
      const logoTextH = doc.heightOfString("[ LOGO ]", { width: logoAreaW });
      doc
        .fillColor(HEADER.logoText)
        .text("[ LOGO ]", logoAreaX, logoAreaY + (logoAreaH - logoTextH) / 2, {
          width: logoAreaW,
          align: "center",
        });
    }

    doc.save();
    doc.font(FONT.bold).fontSize(HEADER.companyNameFontSize).fillColor(HEADER.companyName);
    const companyNameH = doc.heightOfString(companyName, {
      width: infoColW,
      align: "center",
    });
    const companyNameY = headerTop + (headerH - companyNameH) / 2;
    doc.text(companyName, infoX, companyNameY, {
      width: infoColW,
      align: "center",
      lineGap: 0,
    });
    drawCompanySlogan(
      doc,
      companyNameY + companyNameH + COMPANY_SLOGAN.gapAfterName,
      infoX,
      infoColW,
    );
    doc.restore();
    doc.fillColor(COLORS.valueBold);

    y = headerTop + headerH + 10;

    // ── Title bar ───────────────────────────────────────────────────────────
    y = drawPayslipTitleBar(doc, PAGE.left, y, PAGE.width, payMonth);
    y += TITLE_BAR.gapBelow;

    // ── Pay summary bar ───────────────────────────────────────────────────────
    y = drawPaySummaryBar(doc, PAGE.left, y, PAGE.width, [
      { label: "PAY DATE", value: payDate },
      { label: "WORKING DAYS", value: safe(workingDays || company["Working Days"]) },
      { label: "LOP DAYS", value: safe(lopDays) },
      { label: "PAID DAYS", value: safe(paidDays) },
    ]);
    y += compactLayout ? 6 : 8;

    // ── Employee / Role / Location (3 columns) ────────────────────────────────
    const col3W = PAGE.width / 3;
    const sectionTitles = [
      "EMPLOYEE INFORMATION",
      "ROLE & ASSIGNMENT",
      "LOCATION & STATUS",
    ];
    const empSecH = EMP_INFO.headerH;
    const empRowCount = 4;
    const empTableTop = y;

    sectionTitles.forEach((title, i) => {
      doc.rect(PAGE.left + i * col3W, y, col3W, empSecH).fill(EMP_INFO.headerBg);
      doc
        .fillColor(EMP_INFO.headerText)
        .fontSize(EMP_INFO.headerFontSize)
        .font(FONT.bold)
        .text(
          title,
          PAGE.left + i * col3W,
          y + (empSecH - EMP_INFO.headerFontSize) / 2 - 1,
          {
            width: col3W,
            align: "center",
          },
        );
    });
    doc.fillColor(COLORS.valueBold);
    y += empSecH;

    const empBlocks = [
      [
        { label: "Emp ID", value: safe(emp["Emp ID"]) },
        { label: "Name", value: formatPayslipPersonName(safe(emp["Name"])) },
        { label: "Date of Birth", value: safe(emp["Date of Birth"]) },
        { label: "Date of Joining", value: safe(emp["Date of Joining"]) },
      ],
      [
        { label: "Designation", value: safe(emp["Designation"]) },
        { label: "Department", value: safe(emp["Department"]) },
        { label: "Grade / Band", value: safe(emp["Grade"]) },
        { label: "Reporting To", value: safe(emp["Reporting To"]) },
      ],
      [
        { label: "Location", value: safe(emp["Location"]) },
        { label: "Branch", value: safe(emp["Branch"]) },
        { label: "Cost Centre", value: safe(emp["Cost Centre"]) },
        { label: "Employment Type", value: safe(emp["Employment Type"]) },
      ],
    ];

    const allEmpCells = empBlocks.flatMap((block) => block);

    const taxRegime = safe(
      emp["Tax Regime"],
      safe(company["Default Tax Regime"], "New"),
    );
    const pan = safe(emp["PAN"]);
    const aadhaar = safe(emp["Aadhaar"], safe(emp["Aadhaar (last 4)"]));
    const acNo = maskAccountNumber(
      safe(emp["A/C No"], safe(emp["Account Number"])),
    );
    const bank = safe(emp["Bank"], safe(emp["Bank Name"]));
    const ifscMode = formatIfscAndMode(emp);

    const statCells: LabelValuePair[] = [
      { label: "PAN", value: pan },
      { label: "Aadhaar (last 4)", value: aadhaar },
      { label: "Bank", value: bank },
      { label: "Tax Regime", value: taxRegime },
      { label: "A/C No.", value: acNo },
      { label: "IFSC / Mode", value: ifscMode },
    ];

    const unifiedLabelW = measureUniformLabelValueTableLayout(
      doc,
      [...allEmpCells, ...statCells],
      col3W,
      EMP_INFO.labelW,
      EMP_INFO.rowH,
    ).labelW;
    const empLayout = measureUniformLabelValueTableLayout(
      doc,
      allEmpCells,
      col3W,
      EMP_INFO.labelW,
      EMP_INFO.rowH,
      { fixedLabelW: unifiedLabelW },
    );
    const empRowH = empLayout.rowH;
    const labelW = unifiedLabelW;
    const empTableH = empSecH + empRowCount * empRowH;
    const empCellOpts = { style: "empInfo" as const, uniformText: true };

    const empRows: LabelValuePair[][] = [];
    for (let r = 0; r < empRowCount; r++) {
      empRows.push(empBlocks.map((block) => block[r]));
    }
    drawUniformLabelValueGrid(
      doc,
      PAGE.left,
      y,
      [col3W, col3W, col3W],
      empRowH,
      labelW,
      empRows,
      empCellOpts,
    );
    y += empRowCount * empRowH;

    drawInfoTableGrid(doc, PAGE.left, empTableTop, PAGE.width, empTableH, {
      fullHeightColumnXs: [
        PAGE.left + col3W,
        PAGE.left + col3W * 2,
      ],
      dataAreaTop: empTableTop + empSecH,
      dataAreaLabelDividerXs: [0, 1, 2].map(
        (c) => PAGE.left + c * col3W + labelW,
      ),
      rowYs: [
        empTableTop + empSecH,
        ...Array.from({ length: empRowCount - 1 }, (_, r) =>
          empTableTop + empSecH + (r + 1) * empRowH,
        ),
      ],
    });

    y += compactLayout ? 4 : 6;

    // ── Statutory + Bank ──────────────────────────────────────────────────────
    const statColW = PAGE.width / 3;
    const statHeaderW = statColW * 2;
    const bankHeaderW = statColW;
    const statSecH = EMP_INFO.headerH;
    const statTableTop = y;
    const bankColX = PAGE.left + statColW * 2;

    doc.rect(PAGE.left, y, PAGE.width, statSecH).fill(EMP_INFO.headerBg);
    doc.fillColor(EMP_INFO.headerText).fontSize(EMP_INFO.headerFontSize).font(FONT.bold);
    doc.text("STATUTORY IDENTIFIERS", PAGE.left, y + (statSecH - EMP_INFO.headerFontSize) / 2 - 1, {
      width: statHeaderW,
      align: "center",
    });
    doc.text(
      "BANK & PAYMENT",
      bankColX,
      y + (statSecH - EMP_INFO.headerFontSize) / 2 - 1,
      {
        width: bankHeaderW,
        align: "center",
      },
    );
    doc.fillColor(COLORS.valueBold);
    y += statSecH;

    const statLayout = measureUniformLabelValueTableLayout(
      doc,
      statCells,
      statColW,
      EMP_INFO.labelW,
      EMP_INFO.rowH,
      { fixedLabelW: unifiedLabelW },
    );
    const statRowH = statLayout.rowH;
    const statLabelW = unifiedLabelW;
    const statTableH = statSecH + statRowH * 2;
    const statCellOpts = { style: "empInfo" as const, uniformText: true };

    drawUniformLabelValueGrid(
      doc,
      PAGE.left,
      y,
      [statColW, statColW, statColW],
      statRowH,
      statLabelW,
      [
        [
          { label: "PAN", value: pan },
          { label: "Aadhaar (last 4)", value: aadhaar },
          { label: "Bank", value: bank },
        ],
        [
          { label: "Tax Regime", value: taxRegime },
          { label: "A/C No.", value: acNo },
          { label: "IFSC / Mode", value: ifscMode },
        ],
      ],
      statCellOpts,
    );

    drawInfoTableGrid(doc, PAGE.left, statTableTop, PAGE.width, statTableH, {
      dataAreaTop: statTableTop + statSecH,
      dataAreaColumnXs: [PAGE.left + statColW, bankColX],
      dataAreaLabelDividerXs: [0, 1, 2].map(
        (c) => PAGE.left + c * statColW + statLabelW,
      ),
      rowYs: [statTableTop + statSecH, statTableTop + statSecH + statRowH],
    });

    y = statTableTop + statTableH + 6;

    // ── Leave balance ─────────────────────────────────────────────────────────
    const leaveSecH = LEAVE_BALANCE.headerH;
    const leaveValH = compactLayout ? 24 : LEAVE_BALANCE.valueH;
    const leaveTableTop = y;
    const leaveTableH = leaveSecH + leaveValH;
    const leaveCols = [
      { title: "LEAVE BALANCE", w: PAGE.width * 0.28 },
      { title: "EARNED LEAVE (EL)", w: PAGE.width * 0.18 },
      { title: "CASUAL LEAVE (CL)", w: PAGE.width * 0.18 },
      { title: "SICK LEAVE (SL)", w: PAGE.width * 0.18 },
      { title: "COMPENSATION", w: PAGE.width * 0.18 },
    ];
    let lx = PAGE.left;
    leaveCols.forEach((col, i) => {
      doc.rect(lx, y, col.w, leaveSecH).fill(LEAVE_BALANCE.headerBg);
      doc
        .fillColor(LEAVE_BALANCE.headerText)
        .fontSize(FONTS.leaveHeader)
        .font(FONT.bold)
        .text(col.title, lx + (i === 0 ? 8 : 2), y + (leaveSecH - FONTS.leaveHeader) / 2 - 1, {
          width: col.w - (i === 0 ? 10 : 4),
          align: i === 0 ? "left" : "center",
        });
      lx += col.w;
    });
    doc.fillColor(COLORS.valueBold);
    y += leaveSecH;

    const leaveValues = [
      "Available as on month-end",
      formatLeaveBalanceDisplay(emp["EL Balance"]),
      formatLeaveBalanceDisplay(emp["CL Balance"]),
      formatLeaveBalanceDisplay(emp["SL Balance"]),
      formatLeaveBalanceDisplay(emp["Compensation"] ?? emp["Comp Off"]),
    ];
    lx = PAGE.left;
    leaveCols.forEach((col, i) => {
      const cellBg = i === 0 ? LEAVE_BALANCE.noteBg : LEAVE_BALANCE.valueBg;
      doc.rect(lx, y, col.w, leaveValH).fill(cellBg);
      const fs = i === 0 ? FONTS.leaveNote : FONTS.leaveValue;
      doc
        .fontSize(fs)
        .font(i === 0 ? FONT.italic : FONT.bold)
        .fillColor(i === 0 ? LEAVE_BALANCE.noteText : LEAVE_BALANCE.valueText)
        .text(leaveValues[i], lx + (i === 0 ? 8 : 2), y + (leaveValH - fs) / 2 - 1, {
          width: col.w - (i === 0 ? 10 : 4),
          align: i === 0 ? "left" : "center",
        });
      lx += col.w;
    });

    doc.save();
    doc.lineWidth(LEAVE_BALANCE.borderWidth).strokeColor(LEAVE_BALANCE.border);
    doc.rect(PAGE.left, leaveTableTop, PAGE.width, leaveTableH).stroke();
    lx = PAGE.left;
    for (let i = 1; i < leaveCols.length; i++) {
      lx += leaveCols[i - 1].w;
      doc.moveTo(lx, leaveTableTop).lineTo(lx, leaveTableTop + leaveTableH).stroke();
    }
    doc
      .moveTo(PAGE.left, leaveTableTop + leaveSecH)
      .lineTo(PAGE.left + PAGE.width, leaveTableTop + leaveSecH)
      .stroke();
    doc.restore();
    doc.strokeColor(COLORS.borderLight).lineWidth(1);

    y = leaveTableTop + leaveTableH + (compactLayout ? 4 : 6);

    // ── Earnings & Deductions ────────────────────────────────────────────────
    const cols = calcSalaryTableColumns(PAGE.width);
    const { halfW, nameCol, amtCol, ytdCol } = cols;
    const dedLeft = PAGE.left + halfW;
    const tableGeom = {
      earnLeft: PAGE.left,
      dedLeft,
      nameCol,
      amtCol,
      ytdCol,
    };
    const sectionHeaderH = SALARY_TABLE_STYLE.sectionHeaderH;
    const headerBandH = sectionHeaderH;
    const yTableStart = y;
    const tableBottomLimit = contentZoneTop();
    const tableRowH = calcTableRowHeight(yTableStart, totalBodyRows, headerBandH);
    const totalsRowH = LAYOUT.totalsH;

    const drawMergedHeader = (
      baseX: number,
      headers: { text: string; w: number; align: "left" | "right"; fontSize?: number }[],
    ) => {
      let hx = baseX;
      headers.forEach((h) => {
        doc.rect(hx, y, h.w, sectionHeaderH).fill(SALARY_TABLE_STYLE.sectionHeaderBg);
        drawCellText(doc, h.text, hx, y, h.w, sectionHeaderH, {
          fontSize: h.fontSize ?? SALARY_TABLE_STYLE.colHeaderFontSize,
          minFontSize: 5.5,
          align: h.align,
          color: SALARY_TABLE_STYLE.sectionHeaderText,
          bold: true,
          padX: SALARY_TABLE_STYLE.padX,
          padY: SALARY_TABLE_STYLE.padY,
        });
        hx += h.w;
      });
    };

    drawMergedHeader(PAGE.left, [
      {
        text: "EARNINGS",
        w: nameCol,
        align: "left",
        fontSize: SALARY_TABLE_STYLE.sectionHeaderFontSize,
      },
      { text: "Earned (Rs)", w: amtCol, align: "right" },
      { text: "YTD (Rs)", w: ytdCol, align: "right" },
    ]);
    drawMergedHeader(dedLeft, [
      {
        text: "DEDUCTIONS",
        w: nameCol,
        align: "left",
        fontSize: SALARY_TABLE_STYLE.sectionHeaderFontSize,
      },
      { text: "This Month (Rs)", w: amtCol, align: "right" },
      { text: "YTD (Rs)", w: ytdCol, align: "right" },
    ]);
    doc.fillColor(COLORS.valueBold);
    y += sectionHeaderH;

    const dataStartY = y;
    let drawnDataRows = 0;
    for (let i = 0; i < totalBodyRows; i++) {
      if (y + tableRowH > tableBottomLimit - totalsRowH) break;
      const er = i < earningRows.length ? earningRows[i] : undefined;
      const dr = i < deductionRows.length ? deductionRows[i] : undefined;
      drawSalaryTableRow(doc, y, tableRowH, i, tableGeom, {
        earn: er,
        ded: dr,
      });
      y += tableRowH;
      drawnDataRows++;
    }

    const totalsY = y;
    const salaryTableH = totalsY + totalsRowH - yTableStart;
    const salaryRowYs = [
      yTableStart + sectionHeaderH,
      ...Array.from({ length: drawnDataRows - 1 }, (_, i) => dataStartY + (i + 1) * tableRowH),
    ];

    const totalsDrawn = totalsY + totalsRowH <= tableBottomLimit;
    if (totalsDrawn) {
      doc.save();
      doc
        .lineWidth(SALARY_TABLE_STYLE.totalsBorderTopWidth)
        .strokeColor(SALARY_TABLE_STYLE.totalsBorderTop);
      doc.moveTo(PAGE.left, totalsY).lineTo(PAGE.left + PAGE.width, totalsY).stroke();
      doc.restore();

      const totalsNameOpts = {
        fontSize: SALARY_TABLE_STYLE.totalsFontSize,
        minFontSize: 6,
        color: SALARY_TABLE_STYLE.totalsText,
        bold: true,
        padX: SALARY_TABLE_STYLE.padX,
        padY: SALARY_TABLE_STYLE.padY,
        align: "left" as const,
      };
      const totalsAmtOpts = { ...totalsNameOpts, align: "right" as const };

      let rx = PAGE.left;
      doc.rect(rx, totalsY, nameCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(doc, "GROSS EARNINGS", rx, totalsY, nameCol, totalsRowH, totalsNameOpts);
      rx += nameCol;
      doc.rect(rx, totalsY, amtCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(doc, formatAmount(gross), rx, totalsY, amtCol, totalsRowH, totalsAmtOpts);
      rx += amtCol;
      doc.rect(rx, totalsY, ytdCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(doc, formatAmount(grossYtd), rx, totalsY, ytdCol, totalsRowH, totalsAmtOpts);

      let dx = dedLeft;
      doc.rect(dx, totalsY, nameCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(doc, "TOTAL DEDUCTIONS", dx, totalsY, nameCol, totalsRowH, totalsNameOpts);
      dx += nameCol;
      doc.rect(dx, totalsY, amtCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(
        doc,
        formatAmount(totalDeductions),
        dx,
        totalsY,
        amtCol,
        totalsRowH,
        totalsAmtOpts,
      );
      dx += amtCol;
      doc.rect(dx, totalsY, ytdCol, totalsRowH).fill(SALARY_TABLE_STYLE.totalsBg);
      drawCellText(
        doc,
        formatAmount(totalDedYtd),
        dx,
        totalsY,
        ytdCol,
        totalsRowH,
        totalsAmtOpts,
      );
    }

    if (totalsDrawn) {
      y = totalsY + totalsRowH;
    }

    drawSalaryTableGrid(
      doc,
      PAGE.left,
      yTableStart,
      PAGE.width,
      salaryTableH,
      halfW,
      { nameCol, amtCol, ytdCol },
      salaryRowYs,
    );

    const netPayBandY = y + LAYOUT.netPayGapAfterTable;
    drawBottomBand(
      doc,
      netPay,
      company,
      compactLayout,
      netPayBandY,
    );

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}
