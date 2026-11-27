import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getLetterForVerification } from "@/lib/attendance.server";
import { renderAttendanceLetterPdf } from "@/lib/attendance-letter-pdf.server";
import { attendanceLetterPath, isValidLetterReference } from "@/lib/attendance";
import { absoluteUrl } from "@/lib/site-origin";
import { siteOrigin } from "@/lib/site-origin.server";

/** Public PDF copy of an issued letter; the unguessable reference is the key. */
export const Route = createFileRoute("/api/attendance-letter")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reference = new URL(request.url).searchParams.get("reference") ?? "";
        if (!isValidLetterReference(reference)) {
          return new Response("Not found", { status: 404 });
        }

        const letter = await getLetterForVerification(await getSql(), reference);
        if (!letter) return new Response("Not found", { status: 404 });

        const pdf = await renderAttendanceLetterPdf(letter, {
          verifyUrl: absoluteUrl(siteOrigin(request), attendanceLetterPath(reference)),
        });
        return new Response(new Uint8Array(pdf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="attendance-letter-${reference}.pdf"`,
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
