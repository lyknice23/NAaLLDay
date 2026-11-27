import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | ALL DAY NA" },
      {
        name: "description",
        content: "How ALL DAY NA collects, uses, shares, and protects your information.",
      },
    ],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "November 27, 2026";
const CONTACT_EMAIL = "support@alldayna.xyz";

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-display text-xl text-fg">
            ALL DAY NA
          </Link>
          <Link to="/login" className="text-sm text-muted hover:text-fg">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="text-sm font-medium tracking-wide text-primary">Your information</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-fg sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 leading-relaxed text-fg">
          ALL DAY NA is a peer-led online meeting space for people in Narcotics Anonymous and anyone
          exploring recovery. This policy explains what information we collect, why we collect it,
          who we share it with, and the choices you have. It applies to{" "}
          <a
            href="https://www.alldayna.xyz"
            className="text-primary underline-offset-4 hover:underline"
          >
            www.alldayna.xyz
          </a>{" "}
          and the services offered there. It should be read together with our{" "}
          <Link to="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          ALL DAY NA is not a treatment provider, crisis service, or emergency line. If you are in
          immediate danger, contact local emergency services. We are also not affiliated with
          Narcotics Anonymous World Services.
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <Section title="1. Information we collect">
            <p>
              <strong className="text-fg">Account and identity information.</strong> When you
              create an account, we collect your email address and a password. Passwords are stored
              only as a one-way hash. If you sign in with Google or X, we receive your account ID,
              email address, name, and profile image from that provider. We also store your email
              verification status, sessions, the dates you accepted our Terms of Service and Privacy
              Policy, and records of attendance-verification letters you request.
            </p>
            <p>
              <strong className="text-fg">Profile and recovery information.</strong> You choose a
              display name, a role (leader or attendee), and whether you want to be listed as a
              sponsor. If you use the journal, we store your clean date, the days you mark, and any
              notes you write. If you post on the sponsor board, we store the clean time you share,
              your availability window, your note, and comments people leave on your post. If you
              turn on Community sharing, your first name and clean time are shown to other signed-in
              members; you can turn that off at any time. If you share a milestone, we store the
              milestone and the note you choose to share.
            </p>
            <p>
              <strong className="text-fg">Meetings, rooms, and sponsor connections.</strong> We
              store meetings you create, meeting signups, room joins and presence, attendance
              records, chat messages, sponsor connections, and related timestamps. Attendance records
              include the meeting, when you first joined, your latest recorded presence, when you left,
              and the total time you were present. To connect audio and video between participants, we
              use LiveKit Cloud as our media relay. LiveKit processes connection metadata such as IP
              addresses to route the call. We do not record or store the audio or video itself.
            </p>
            <p>
              <strong className="text-fg">Attendance verification requests.</strong> When you ask us
              to email a verification letter, we store the meeting, the full legal name you enter for
              the letter, your account email address, the generated letter, the reference that
              identifies it, the request date, and whether delivery succeeded. The legal name is kept
              on your profile so later letters can reuse it; it is not shown in meetings or on the
              Community board. The letter and its PDF are based on your platform attendance record
              and are sent through Resend to the email address on your account. Anyone who has the
              reference can open the public verification page and see the name, meeting, and recorded
              attendance printed on that letter.
            </p>
            <p>
              <strong className="text-fg">Camera and microphone.</strong> Camera and microphone
              access is off until you turn it on. When enabled, your audio and video are relayed
              through LiveKit Cloud to the other people in that room so they can see and hear you.
              They are not recorded by ALL DAY NA.
            </p>
            <p>
              <strong className="text-fg">Communications and technical information.</strong> We
              store the emails we send you for verification, password reset, and attendance
              verification, and any messages you send to support. Like most websites, we receive technical information such as your IP
              address, browser and device type, pages requested, and timestamps. We use essential
              cookies and browser storage to keep you signed in and to operate the app.
            </p>
            <p>
              <strong className="text-fg">Sensitive information.</strong> Your clean date, journal
              notes, meeting participation, and sponsor posts can reveal information about your
              health and recovery. You choose whether to provide this information. Please share only
              what you are comfortable storing with us.
            </p>
          </Section>

          <Section title="2. How we use your information">
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>create and secure your account, verify your email, and reset your password;</li>
              <li>run meetings, presence, chat, sponsor connections, and video rooms;</li>
              <li>record attendance and generate the verification letters you request;</li>
              <li>maintain your journal, milestones, reminders, and notifications;</li>
              <li>show the display name, role, sponsor post, shared clean time, and shared achievement you choose to publish;</li>
              <li>enforce our terms, prevent abuse, and keep the service safe;</li>
              <li>respond to support requests, troubleshoot problems, and improve the service; and</li>
              <li>comply with applicable law and protect the rights and safety of our users.</li>
            </ul>
            <p>
              We do not sell your personal information. We do not use third-party advertising
              networks, data brokers, or cross-site tracking. We do not use your private journal,
              room chat, or meeting content to build advertising profiles.
            </p>
          </Section>

          <Section title="3. What other people can see">
            <p>
              Your display name, role, sponsor status, meetings you create, sponsor posts, sponsor
              comments, and milestones you choose to share are visible to other signed-in users. If
              you turn on Community sharing, your first name and how long you have been clean are
              also visible there. Room chat and presence are visible to people in that room.
              Sponsor connections and their video and chat rooms are limited to the two people in the
              connection. Your attendance history and verification requests are private to your
              account, except for the letter you ask us to email to your account address.
            </p>
            <p>
              Your journal notes and exact clean date are private to your account. The exceptions
              are content you deliberately publish: a milestone and note you share, or your first
              name and clean time when you turn on Community sharing. Even then, your journal entries
              and exact clean date are not shown. You can turn Community sharing off whenever you
              want.
            </p>
            <p>
              <strong className="text-fg">Media relay.</strong> Audio and video in a room are sent
              through LiveKit Cloud, our WebRTC media relay. LiveKit processes connection metadata
              such as IP addresses to route the call; we do not record or store the audio or video.
              We do not control what other participants do with information you share in a room.
            </p>
            <p>
              Please do not post another person’s private information, and do not record or
              screenshot other people without their permission.
            </p>
          </Section>

          <Section title="4. Service providers and sharing">
            <p>
              We share information with service providers that help us operate ALL DAY NA, only as
              needed for the service:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-fg">Vercel</strong> hosts the application.
              </li>
              <li>
                <strong className="text-fg">Neon</strong> hosts our PostgreSQL database.
              </li>
              <li>
                <strong className="text-fg">LiveKit Cloud</strong> relays audio and video for
                meetings and private rooms.
              </li>
              <li>
                <strong className="text-fg">Resend</strong> delivers verification, password-reset,
                and attendance-verification emails.
              </li>
              <li>
                <strong className="text-fg">Google Fonts</strong> serves the fonts used on the site,
                which means Google receives the network request needed to load them.
              </li>
              <li>
                <strong className="text-fg">Google and X</strong> handle sign-in when you choose
                those providers, under their own privacy policies.
              </li>
            </ul>
            <p>
              We may also disclose information if required by law, to respond to valid legal
              process, to protect the safety of a person or the public, to investigate abuse, or as
              part of a merger, acquisition, or transfer of the service. If we transfer the service,
              we will require the recipient to honor this policy.
            </p>
            <p>
              Links to outside resources, such as the SAMHSA treatment locator and partner offers,
              are governed by those sites’ own policies. We do not share your journal or account
              information with those sites when you click a link.
            </p>
          </Section>

          <Section title="5. Cookies and browser storage">
            <p>
              We use essential cookies to keep you signed in and to protect your session. Some
              session information may be cached in a short-lived cookie so the app loads faster. In
              local preview environments, a session token may be kept in browser session storage.
              We also use browser storage for small interface details, such as a verification code
              shown during local development.
            </p>
            <p>
              We do not use advertising cookies or third-party analytics trackers. Clearing cookies
              or site data will sign you out. Browser notifications are optional and only start
              after you grant permission.
            </p>
          </Section>

          <Section title="6. How long we keep information">
            <p>
              We keep account, profile, journal, meeting, chat, and sponsor information while your
              account is active or as needed to provide the service. WebRTC signaling data is
              temporary and is deleted after a short period. Verification codes expire after 10
              minutes, and password-reset links expire after one hour. Presence information becomes
              stale within about 30 seconds, though a presence record may remain until it is
              cleaned up or you leave the room. Attendance records and verification-request records
              are kept while your account is active or as needed to provide the service, resolve
              disputes, or meet legal obligations. A copy of a letter may remain in your email
              provider, in our email delivery records, or with anyone you forward it to.
            </p>
            <p>
              If you delete content or ask us to delete your account, we will remove it from the
              active service, but some information may remain in backups for a limited period, in
              records we must keep by law, or in copies other people made. Chat messages and shared
              achievements may also remain visible to other participants or users after you delete
              your account.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use HTTPS, hash passwords, encrypt stored OAuth tokens, restrict access to
              production systems, and use security-focused session cookies. No service is perfectly
              secure. Please use a unique password, keep it private, and sign out on shared devices.
              Be careful about what you share in a room, because other participants can see and
              potentially copy it.
            </p>
          </Section>

          <Section title="8. Your choices and rights">
            <p>
              You can review and change your profile and journal information in the app. You can
              delete journal entries, sponsor posts, and shared milestones through the relevant
              screens. You can turn camera and microphone access off at any time. You can request a
              copy of an attendance letter for any eligible meeting from your homepage; contact us if
              you need help with an attendance record or a letter that was already sent.
            </p>
            <p>
              To request access to, correction of, export of, or deletion of your personal
              information, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . We may need to verify your identity before acting on a request. You may also ask us
              to restrict or object to certain processing, or withdraw consent for optional
              information. Withdrawing consent does not affect processing that already happened.
            </p>
            <p>
              Depending on where you live, you may have additional rights under laws such as the
              GDPR or the CCPA/CPRA, including the right to complain to your local data-protection
              authority. We do not sell personal information, and we will not discriminate against
              you for exercising your privacy rights.
            </p>
            <p>
              We send transactional email for verification and password reset. We do not send
              marketing email. Account deletion requests can be sent to the same support address.
            </p>
          </Section>

          <Section title="9. Children">
            <p>
              ALL DAY NA is intended for adults aged 18 and older. It is not directed to children,
              and we do not knowingly collect personal information from anyone under 18. If you
              believe a child has provided us information, contact us and we will delete it.
            </p>
          </Section>

          <Section title="10. International processing">
            <p>
              ALL DAY NA is operated from the United States, and our service providers may process
              information in the United States and other countries. Those countries may have
              different data-protection laws than your own. Where required, we use appropriate
              safeguards for cross-border transfers.
            </p>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy as the service changes. The date at the top shows the latest
              version. If a change is material, we will provide a clear notice in the app or by
              email before it takes effect. Continuing to use ALL DAY NA after an update means you
              accept the revised policy.
            </p>
          </Section>

          <Section title="12. Contact us">
            <p>
              Questions, privacy requests, or concerns can be sent to{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . We will review and respond as promptly as we can.
            </p>
            <p className="text-muted">
              ALL DAY NA is an independent recovery tool and is not affiliated with, endorsed by, or
              operated by Narcotics Anonymous World Services.
            </p>
          </Section>
        </div>

        <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm text-muted">
          <Link to="/" className="hover:text-fg">
            Meetings
          </Link>
          <Link to="/terms" className="hover:text-fg">
            Terms of Service
          </Link>
          <Link to="/help" className="hover:text-fg">
            Find help
          </Link>
          <Link to="/login" className="hover:text-fg">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl leading-snug text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-muted">{children}</div>
    </section>
  );
}
