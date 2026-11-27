import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatDuration, formatUtcDateTime } from "./attendance.ts";
import type { AttendanceLetterSnapshot } from "./attendance.server";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = MARGIN + 64;

const INK = rgb(0.11, 0.13, 0.09);
const MUTED = rgb(0.38, 0.41, 0.36);
const RULE = rgb(0.82, 0.84, 0.8);

/**
 * pdf-lib's standard fonts are WinAnsi-only. A legal name may contain
 * characters outside that set, so replace anything the font cannot encode
 * rather than failing the whole document.
 */
function safeTextFor(font: PDFFont): (value: string) => string {
  const cache = new Map<string, string>();
  return (value) => {
    let out = "";
    for (const character of value) {
      const cached = cache.get(character);
      if (cached !== undefined) {
        out += cached;
        continue;
      }
      let safe = character;
      try {
        font.encodeText(character);
      } catch {
        safe = "?";
      }
      cache.set(character, safe);
      out += safe;
    }
    return out;
  };
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function renderAttendanceLetterPdf(
  letter: AttendanceLetterSnapshot,
  options: { verifyUrl: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Attendance verification letter — ${letter.reference}`);
  doc.setAuthor("ALL DAY NA");
  doc.setSubject("Attendance verification");
  doc.setCreator("ALL DAY NA");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const safeRegular = safeTextFor(regular);
  const safeBold = safeTextFor(bold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawText(safeBold("ALL DAY NA"), {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN,
      size: 10,
      font: bold,
      color: MUTED,
    });
    y = PAGE_HEIGHT - MARGIN - 30;
  };

  const ensureSpace = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };

  const paragraph = (value: string) => {
    const size = 10.5;
    const lines = wrap(value, regular, size, CONTENT_WIDTH);
    ensureSpace(lines.length * 14.5 + 12);
    for (const line of lines) {
      page.drawText(safeRegular(line), {
        x: MARGIN,
        y,
        size,
        font: regular,
        color: INK,
      });
      y -= 14.5;
    }
    y -= 10;
  };

  const field = (label: string, value: string, strong = false) => {
    const size = 11;
    const valueFont = strong ? bold : regular;
    const valueX = MARGIN + 132;
    const lines = wrap(value, valueFont, size, PAGE_WIDTH - MARGIN - valueX);
    ensureSpace(lines.length * 15 + 8);
    page.drawText(safeBold(label), {
      x: MARGIN,
      y,
      size: 9.5,
      font: bold,
      color: MUTED,
    });
    for (const line of lines) {
      page.drawText((strong ? safeBold : safeRegular)(line), {
        x: valueX,
        y,
        size,
        font: valueFont,
        color: INK,
      });
      y -= 15;
    }
    y -= 6;
  };

  const duration = formatDuration(letter.durationSeconds);

  // Letterhead.
  page.drawText(safeBold("ALL DAY NA"), { x: MARGIN, y, size: 22, font: bold, color: INK });
  y -= 22;
  page.drawText(safeRegular("Attendance verification"), {
    x: MARGIN,
    y,
    size: 11,
    font: regular,
    color: MUTED,
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: RULE,
  });
  y -= 28;

  field("Participant", letter.participantName, true);
  field("Meeting", letter.meetingTitle);
  field("Format", letter.meetingFormat);
  field("Meeting leader", letter.leaderName);
  field("Scheduled start", formatUtcDateTime(letter.startsAt));
  field("Recorded attendance", `approximately ${duration}`);
  field("Reference", letter.reference);
  field("Issued", formatUtcDateTime(letter.issuedAt));

  y -= 6;
  paragraph(
    `Our records show that the account holder joined this online meeting and was present for approximately ${duration}. Attendance is recorded automatically from room presence and may not include time when the connection was lost, the tab was closed, or the person stepped away.`,
  );
  paragraph(
    "This letter confirms platform attendance only. It does not verify identity, recovery status, or completion of any court, parole, or treatment requirement. ALL DAY NA is peer-led and is not affiliated with Narcotics Anonymous World Services.",
  );

  // Footer: where a reader can confirm the letter and how to reach support.
  const footerY = MARGIN + 30;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 22 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 22 },
    thickness: 0.75,
    color: RULE,
  });
  const footerLines = wrap(
    `Verify this letter: ${options.verifyUrl}`,
    regular,
    8.5,
    CONTENT_WIDTH,
  );
  let footerCursor = footerY + 8;
  for (const line of footerLines) {
    page.drawText(safeRegular(line), {
      x: MARGIN,
      y: footerCursor,
      size: 8.5,
      font: regular,
      color: MUTED,
    });
    footerCursor -= 11;
  }
  page.drawText(safeRegular("Questions: support@alldayna.xyz"), {
    x: MARGIN,
    y: footerCursor,
    size: 8.5,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}
