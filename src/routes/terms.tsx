import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | ALL DAY NA" },
      {
        name: "description",
        content: "The rules for using ALL DAY NA meetings, rooms, journal, and sponsor features.",
      },
    ],
  }),
  component: TermsOfServicePage,
});

const LAST_UPDATED = "November 26, 2026";
const CONTACT_EMAIL = "support@alldayna.xyz";

function TermsOfServicePage() {
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
        <p className="text-sm font-medium tracking-wide text-primary">Using the service</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-fg sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 leading-relaxed text-fg">
          These Terms of Service (“Terms”) are an agreement between you and ALL DAY NA. They cover
          your use of{" "}
          <a
            href="https://www.alldayna.xyz"
            className="text-primary underline-offset-4 hover:underline"
          >
            www.alldayna.xyz
          </a>{" "}
          and the meetings, rooms, journal, sponsor board, and other features offered there.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          By creating an account, signing in, or using the service, you agree to these Terms and our{" "}
          <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use ALL DAY NA.
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <Section title="1. Who we are">
            <p>
              ALL DAY NA is an independent peer-support project for people in Narcotics Anonymous
              and anyone exploring recovery. We are not Narcotics Anonymous World Services, and we
              are not affiliated with, endorsed by, or operated by them. References to Narcotics
              Anonymous describe the style of peer support offered here; they do not make this an
              official NA service.
            </p>
            <p>
              ALL DAY NA is not a treatment provider, medical practice, therapy service, crisis
              line, or emergency service. We do not provide medical advice, diagnosis, or treatment.
              If you are in immediate danger, contact local emergency services. If you need treatment
              or crisis support, use the resources on our{" "}
              <Link to="/help" className="text-primary underline-offset-4 hover:underline">
                find help page
              </Link>{" "}
              or contact a qualified professional.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old to use ALL DAY NA. By using the service, you
              represent that you meet that requirement and that you can form a binding agreement
              with us. If you use the service on behalf of an organization, you represent that you
              have authority to bind that organization.
            </p>
          </Section>

          <Section title="3. The service">
            <p>
              ALL DAY NA lets people schedule and attend peer-led online meetings, join video rooms,
              keep a private clean-day journal, share milestones, and connect with sponsors. Meetings
              are led by volunteers and are not moderated by professional clinicians. We do not
              verify the identity, recovery, qualifications, or intentions of anyone using the
              service.
            </p>
            <p>
              Meetings are generally one hour long, rooms hold up to 50 people, and joining closes 20
              minutes after the scheduled start. Leaders may open their own room after that point.
              After their first week, leaders are expected to guide at least three meetings per week;
              failing to do so may suspend leader access. Suspended leaders may still attend
              meetings.
            </p>
            <p>
              We may change, suspend, or discontinue features at any time. We do not guarantee that a
              meeting will take place, that a room will be available, or that any particular person
              will attend.
            </p>
          </Section>

          <Section title="4. Your account">
            <p>
              You must provide accurate account information and keep your password private. You are
              responsible for activity under your account. Notify us promptly if you believe your
              account has been compromised. Do not share your account, impersonate another person,
              or create an account to evade a suspension.
            </p>
            <p>
              You may request deletion of your account by emailing{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              . Some information may remain in backups, legal records, or content other people have
              already seen or copied.
            </p>
          </Section>

          <Section title="5. Community rules">
            <p>ALL DAY NA depends on people treating each other with care. You agree to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>be respectful and avoid harassment, threats, hate speech, and bullying;</li>
              <li>use a first name or a name you are comfortable being called;</li>
              <li>not record, screenshot, or share what someone shares in a meeting or private room without their permission;</li>
              <li>not post another person’s private information, including addresses, phone numbers, or identifying details;</li>
              <li>not impersonate another person, a leader, a sponsor, or ALL DAY NA staff;</li>
              <li>not spam, advertise unrelated products, or solicit money;</li>
              <li>not post content that is illegal, exploitative, or sexually explicit; and</li>
              <li>follow the meeting’s stated format and the leader’s reasonable requests.</li>
            </ul>
            <p>
              These rules apply in meetings, rooms, chat, the sponsor board, shared achievements, and
              any interaction connected to ALL DAY NA.
            </p>
          </Section>

          <Section title="6. Meetings, rooms, and video">
            <p>
              Meetings are peer-led conversations. Leaders are volunteers, not employees or agents of
              ALL DAY NA. The views shared in a meeting belong to the people who share them and do
              not represent our views.
            </p>
            <p>
              Camera and microphone access is off until you enable it. Audio and video travel
              directly between participants using WebRTC and are not recorded by ALL DAY NA. Other
              participants may still be able to see, hear, or copy what you share. Use good judgment
              about what you disclose, and do not join a room if you are not comfortable with the
              people in it.
            </p>
            <p>
              You may not record a meeting or room, or use another person’s video, audio, image, or
              words for advertising, training, or other unrelated purposes without their permission.
            </p>
          </Section>

          <Section title="7. Sponsors and recovery information">
            <p>
              Sponsor availability, clean time, and recovery details are self-reported. We do not
              verify them. A sponsor is a peer, not a clinician, and is not acting on our behalf.
              Use your own judgment before connecting with someone, and never rely on a sponsor for
              medical or emergency care.
            </p>
            <p>
              The journal is a personal tracking tool, not a medical record. Clean dates and notes
              are private to your account except for a milestone and note you deliberately share.
              You are responsible for the accuracy of the information you provide.
            </p>
          </Section>

          <Section title="8. Your content">
            <p>
              You keep ownership of the content you create, including meeting descriptions, chat
              messages, journal notes, sponsor posts, and shared achievements. You give ALL DAY NA a
              limited, non-exclusive license to host, store, reproduce, display, and transmit that
              content as needed to operate the service and show it to the people you choose to share
              it with. This license ends when you delete the content or your account, except for
              copies already shared with others, backups, or records we must keep.
            </p>
            <p>
              You are responsible for your content and for having the rights needed to post it. Do
              not post content that belongs to someone else without permission. We may remove content
              or restrict access if we believe it violates these Terms or creates risk for others.
            </p>
            <p>
              If you share a milestone or sponsor post, other signed-in users can see it. Do not
              share information you want to keep private. Journal entries are not posted publicly
              unless you deliberately share a milestone and note.
            </p>
          </Section>

          <Section title="9. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>use the service for illegal activity or to harm another person;</li>
              <li>attempt to access another person’s account, data, or private room;</li>
              <li>probe, scan, or test the security of the service without our written permission;</li>
              <li>scrape, copy, or bulk-collect other people’s information;</li>
              <li>upload malware or interfere with the service’s operation;</li>
              <li>use bots or automated tools to post, sign up, or disrupt meetings; or</li>
              <li>help anyone else do any of the above.</li>
            </ul>
            <p>
              We may investigate suspected violations and cooperate with law enforcement when
              appropriate. We may also remove content, suspend access, or close an account when we
              believe it is necessary to protect users or the service.
            </p>
          </Section>

          <Section title="10. Privacy">
            <p>
              Our{" "}
              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>{" "}
              explains what information we collect and how we use it. It is part of these Terms. By
              using ALL DAY NA, you acknowledge that we process information as described there.
            </p>
          </Section>

          <Section title="11. Third-party services">
            <p>
              We use service providers such as Vercel for hosting, Neon for our database, Resend for
              email, and Google Fonts for fonts. If you sign in with Google or X, that provider’s
              terms and privacy policy also apply to the sign-in. We are not responsible for
              third-party websites or services, including the SAMHSA locator or partner offers linked
              from the app.
            </p>
          </Section>

          <Section title="12. Suspension and termination">
            <p>
              You may stop using ALL DAY NA at any time. We may suspend or terminate your access if
              you violate these Terms, if your account creates risk for other users, or if we are
              required to do so by law. We may also suspend or discontinue the service itself.
            </p>
            <p>
              If your account is terminated, you may lose access to your journal, meetings, messages,
              and other content. Sections that by their nature should survive termination — including
              ownership, disclaimers, limitation of liability, and indemnity — will continue to
              apply.
            </p>
          </Section>

          <Section title="13. Disclaimers">
            <p>
              ALL DAY NA is provided “as is” and “as available.” To the fullest extent permitted by
              law, we disclaim all warranties, express or implied, including warranties of
              merchantability, fitness for a particular purpose, non-infringement, and
              uninterrupted or error-free operation.
            </p>
            <p>
              We do not warrant that the service will be safe, that users will behave appropriately,
              that information shared by users is accurate, or that the service will meet your
              needs. You use the service and interact with other users at your own risk. Nothing in
              these Terms excludes rights that cannot be excluded under applicable law.
            </p>
          </Section>

          <Section title="14. Limitation of liability">
            <p>
              To the fullest extent permitted by law, ALL DAY NA and the people who operate it will
              not be liable for indirect, incidental, special, consequential, or punitive damages,
              or for lost profits, lost data, personal injury, or emotional distress arising from
              your use of the service or interactions with other users.
            </p>
            <p>
              To the fullest extent permitted by law, our total liability for any claim arising out
              of or relating to the service will not exceed one hundred U.S. dollars (US $100). Some
              jurisdictions do not allow certain limitations, so part of this section may not apply
              to you. Nothing here limits liability that cannot legally be limited.
            </p>
          </Section>

          <Section title="15. Indemnity">
            <p>
              To the extent permitted by law, you agree to indemnify and hold harmless ALL DAY NA and
              the people who operate it from claims, losses, liabilities, and expenses (including
              reasonable legal fees) arising from your content, your use of the service, or your
              violation of these Terms or another person’s rights.
            </p>
          </Section>

          <Section title="16. Intellectual property">
            <p>
              The ALL DAY NA name, design, software, and original content are owned by or licensed to
              us and are protected by intellectual-property laws. These Terms do not give you
              ownership of our branding or software. You may not copy, modify, distribute, or create
              derivative works from our service except as allowed by law or with our written
              permission.
            </p>
            <p>
              If you believe content on ALL DAY NA infringes your copyright, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with enough detail for us to identify the content and your rights. We may remove
              allegedly infringing content while we review a report.
            </p>
          </Section>

          <Section title="17. Changes to these Terms">
            <p>
              We may update these Terms as the service changes. The date at the top shows the latest
              version. If a change is material, we will provide a clear notice in the app or by email
              before it takes effect. Continuing to use ALL DAY NA after an update means you accept
              the revised Terms.
            </p>
          </Section>

          <Section title="18. General">
            <p>
              If any part of these Terms is found unenforceable, the rest will remain in effect. Our
              failure to enforce a provision is not a waiver. You may not assign your rights under
              these Terms without our consent; we may assign ours as part of a merger, acquisition,
              or transfer of the service. These Terms and the Privacy Policy are the entire agreement
              between you and us about the service.
            </p>
            <p>
              These Terms are governed by the laws applicable to the operator of ALL DAY NA, without
              regard to conflict-of-law rules. If you are a consumer, you may also have mandatory
              rights under the laws of your country. Nothing in these Terms limits those rights.
            </p>
          </Section>

          <Section title="19. Contact">
            <p>
              Questions about these Terms or the service can be sent to{" "}
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
          <Link to="/privacy" className="hover:text-fg">
            Privacy Policy
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
