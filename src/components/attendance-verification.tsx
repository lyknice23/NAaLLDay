import { useEffect, useState } from "react";
import { listAttendance, requestAttendanceLetter } from "@/lib/attendance.functions";
import { MIN_ATTENDANCE_MINUTES, formatDuration, type AttendanceRecord } from "@/lib/attendance";

type LetterDelivery = {
  sentTo: string;
  preview: string | null;
};

export function AttendanceVerification() {
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [meetingId, setMeetingId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<LetterDelivery | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAttendance()
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows);
        setMeetingId(rows.find((row) => row.eligible)?.meetingId ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRecords([]);
        setError(err instanceof Error ? err.message : "Could not load your attendance.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eligible = records?.filter((record) => record.eligible) ?? [];

  return (
    <section
      aria-labelledby="attendance-verification-heading"
      className="mt-10 rounded-xl border border-border bg-surface p-5"
    >
      <p className="text-sm font-medium text-primary">Attendance verification</p>
      <h2 id="attendance-verification-heading" className="mt-1 font-display text-2xl text-fg">
        Need proof you were in a meeting?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        We save the meeting, when you joined, and how long you were present. After a meeting ends,
        choose it below and we will email a verification letter to the address on your account. It
        is a platform attendance record, not an official court or parole document.
      </p>

      {records === null && <p className="mt-4 text-sm text-muted">Loading your attendance…</p>}

      {records !== null && records.length === 0 && !error && (
        <p className="mt-4 rounded-lg border border-border bg-bg px-4 py-3 text-sm text-muted">
          {`No attendance has been recorded yet. Join a meeting and stay for at least ${MIN_ATTENDANCE_MINUTES} minutes; it will appear here after the meeting ends.`}
        </p>
      )}

      {records !== null && records.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-fg">Recent attendance</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-bg px-4">
            {records.slice(0, 6).map((record) => (
              <li
                key={record.meetingId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
              >
                <span className="text-fg">
                  {record.title}
                  <span className="text-muted">
                    {" "}
                    · {new Date(record.startsAt).toLocaleString()}
                  </span>
                </span>
                <span className="text-muted">
                  {formatDuration(record.durationSeconds)}
                  {record.eligible ? " · ready for a letter" : " · not eligible yet"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eligible.length > 0 && (
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setDelivery(null);
            void requestAttendanceLetter({ data: { meetingId } })
              .then((result) => {
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setDelivery({
                  sentTo: result.sentTo,
                  preview: result.preview,
                });
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not prepare your letter."),
              )
              .finally(() => setPending(false));
          }}
        >
          <label className="flex-1 text-sm text-muted">
            Meeting you attended
            <select
              value={meetingId}
              onChange={(event) => {
                setMeetingId(event.target.value);
                setDelivery(null);
                setError("");
              }}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-bg px-3 text-fg"
            >
              {eligible.map((record) => (
                <option key={record.meetingId} value={record.meetingId}>
                  {record.title} · {new Date(record.startsAt).toLocaleDateString()} ·{" "}
                  {formatDuration(record.durationSeconds)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending || !meetingId}
            className="h-11 shrink-0 rounded-lg bg-primary px-5 font-semibold text-primary-fg disabled:opacity-60"
          >
            {pending ? "Preparing letter…" : "Email my letter"}
          </button>
        </form>
      )}

      {records !== null && records.length > 0 && eligible.length === 0 && !error && (
        <p className="mt-4 text-sm text-muted">
          {`Letters become available after the meeting ends and you have at least ${MIN_ATTENDANCE_MINUTES} minutes of recorded attendance.`}
        </p>
      )}

      {delivery && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-bg px-4 py-3 text-sm text-fg">
          {delivery.preview ? (
            <p>
              Email delivery is not configured in this environment. Your letter was generated and
              recorded as a preview; you can review it below.
            </p>
          ) : (
            <p>
              Letter sent to <span className="font-semibold">{delivery.sentTo}</span>. Check your
              inbox and spam folder. You can request another copy after one minute.
            </p>
          )}
          {delivery.preview && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold text-primary">
                View your letter
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 font-sans text-sm leading-relaxed text-fg">
                {delivery.preview}
              </pre>
            </details>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
