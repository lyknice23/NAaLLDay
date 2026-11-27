import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getAttendanceLetterVerification,
  type AttendanceLetterVerification,
} from "@/lib/attendance.functions";
import {
  attendanceLetterPdfPath,
  formatDuration,
  formatUtcDateTime,
} from "@/lib/attendance";

export const Route = createFileRoute("/verify/$reference")({
  head: () => ({
    meta: [
      { title: "Verify an attendance letter | ALL DAY NA" },
      {
        name: "description",
        content: "Check that an ALL DAY NA attendance verification letter was issued by us.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyLetterPage,
});

function VerifyLetterPage() {
  const { reference } = Route.useParams();
  const [result, setResult] = useState<AttendanceLetterVerification | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    getAttendanceLetterVerification({ data: { reference } })
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch(() => {
        if (!cancelled) setResult({ found: false });
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-display text-xl text-fg">
            ALL DAY NA
          </Link>
          <Link to="/" className="text-sm text-muted hover:text-fg">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        {result === null && (
          <p className="text-muted" role="status">
            Checking that reference…
          </p>
        )}

        {result && !result.found && (
          <>
            <p className="text-sm font-medium tracking-wide text-primary">Letter verification</p>
            <h1 className="mt-2 font-display text-4xl leading-tight text-fg">
              We could not verify that reference.
            </h1>
            <p className="mt-4 leading-relaxed text-muted">
              No letter with this reference exists in our records. Check that the link was copied
              exactly as it appears on the letter. References are created when a letter is issued,
              so a mistyped or invented reference will not match anything.
            </p>
            <p className="mt-4 text-sm text-muted">
              If the link came from a letter we emailed you, contact{" "}
              <a
                href="mailto:support@alldayna.xyz"
                className="text-primary underline-offset-4 hover:underline"
              >
                support@alldayna.xyz
              </a>
              .
            </p>
          </>
        )}

        {result && result.found && (
          <>
            <p className="text-sm font-medium tracking-wide text-primary">Verified record</p>
            <h1 className="mt-2 font-display text-4xl leading-tight text-fg">
              This letter was issued by ALL DAY NA.
            </h1>
            <p className="mt-3 text-sm text-muted">
              Reference{" "}
              <span className="font-mono text-xs break-all text-fg">{result.letter.reference}</span>
            </p>

            <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface px-5">
              <Row label="Participant" value={result.letter.participantName} strong />
              <Row label="Meeting" value={result.letter.meetingTitle} />
              <Row label="Format" value={result.letter.meetingFormat} />
              <Row label="Meeting leader" value={result.letter.leaderName} />
              <Row label="Scheduled start" value={formatUtcDateTime(result.letter.startsAt)} />
              <Row
                label="Recorded attendance"
                value={`approximately ${formatDuration(result.letter.durationSeconds)}`}
              />
              <Row label="Issued" value={formatUtcDateTime(result.letter.issuedAt)} />
            </dl>

            <a
              href={attendanceLetterPdfPath(result.letter.reference)}
              className="mt-6 flex h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
            >
              Download the PDF
            </a>

            <p className="mt-5 text-sm leading-relaxed text-muted">
              This page confirms that ALL DAY NA issued the letter described above. It confirms
              platform attendance only. It does not verify identity, recovery status, or completion
              of any court, parole, or treatment requirement.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-right text-sm ${strong ? "font-semibold text-fg" : "text-fg"}`}>
        {value}
      </dd>
    </div>
  );
}
