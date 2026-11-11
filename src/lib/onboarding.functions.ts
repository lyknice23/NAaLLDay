import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email.server";
import {
  CURRENT_TERMS_VERSION,
  resolveOnboardingStep,
  type OnboardingState,
} from "@/lib/onboarding";

const CODE_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

type UserRow = {
  email: string;
  email_verified: boolean;
  oauth: boolean;
};

async function readUser(userId: string): Promise<UserRow | null> {
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select u.email,
           u."emailVerified" as email_verified,
           exists (
             select 1 from "account" a
             where a."userId" = u.id and a."providerId" <> 'credential'
           ) as oauth
    from "user" u
    where u.id = ${userId}
  `;
  return rows[0] ?? null;
}

async function loadOnboardingState(userId: string): Promise<OnboardingState> {
  const sql = await getSql();
  const user = await readUser(userId);
  const profileRows = await sql<{
    display_name: string;
    role: "leader" | "attendee";
    wants_sponsor: boolean;
    onboarding_completed_at: string | null;
    clean_since: string | null;
    clean_days: number;
    can_sponsor: boolean;
  }>`
    select p.display_name,
           p.role,
           p.wants_sponsor,
           p.onboarding_completed_at::text as onboarding_completed_at,
           cj.clean_since::text as clean_since,
           coalesce((current_date - cj.clean_since)::int, 0) as clean_days,
           (cj.clean_since is not null
             and cj.clean_since <= current_date - interval '2 years') as can_sponsor
    from profiles p
    left join clean_journals cj on cj.user_id = p.user_id
    where p.user_id = ${userId}
  `;
  const consentRows = await sql<{ accepted: boolean }>`
    select exists (
      select 1 from user_consents
      where user_id = ${userId} and terms_version = ${CURRENT_TERMS_VERSION}
    ) as accepted
  `;

  const row = profileRows[0];
  const emailVerified = user ? Boolean(user.email_verified || user.oauth) : true;
  const termsAccepted = Boolean(consentRows[0]?.accepted);
  const profile = row
    ? {
        displayName: row.display_name,
        role: row.role,
        wantsSponsor: Boolean(row.wants_sponsor),
        cleanSince: row.clean_since,
        cleanDays: Number(row.clean_days ?? 0),
        canSponsor: Boolean(row.can_sponsor),
        completedAt: row.onboarding_completed_at,
      }
    : null;

  return {
    email: user?.email ?? null,
    emailVerified,
    termsAccepted,
    termsVersion: CURRENT_TERMS_VERSION,
    profile,
    step: resolveOnboardingStep({
      emailVerified,
      termsAccepted,
      hasProfile: Boolean(profile),
      onboardingCompleted: Boolean(profile?.completedAt),
    }),
  };
}

function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadOnboardingState(context.userId));

export const requestEmailCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const user = await readUser(context.userId);
    if (!user) {
      return { ok: false as const, error: "Sign in again to verify your email." };
    }
    if (user.email_verified || user.oauth) {
      return { ok: true as const, alreadyVerified: true };
    }

    const cooldownRows = await sql<{ retry_after: number }>`
      select greatest(
        0,
        ${CODE_COOLDOWN_SECONDS} -
          floor(extract(epoch from (now() - last_sent_at)))
      )::int as retry_after
      from email_verification_codes
      where user_id = ${context.userId}
    `;
    const retryAfter = Number(cooldownRows[0]?.retry_after ?? 0);
    if (retryAfter > 0) {
      return {
        ok: false as const,
        error: `Wait ${retryAfter} seconds before requesting another code.`,
        retryAfter,
      };
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashCode(context.userId, code);
    await sql`
      insert into email_verification_codes
        (user_id, email, code_hash, expires_at, attempts, last_sent_at)
      values (
        ${context.userId},
        ${user.email},
        ${codeHash},
        now() + interval '10 minutes',
        0,
        now()
      )
      on conflict (user_id) do update set
        email = excluded.email,
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        last_sent_at = now()
    `;

    const sent = await sendVerificationEmail(user.email, code);
    if (!sent.ok) {
      await sql`delete from email_verification_codes where user_id = ${context.userId}`;
      return { ok: false as const, error: sent.error };
    }

    return {
      ok: true as const,
      devCode: sent.devCode,
      retryAfter: CODE_COOLDOWN_SECONDS,
      email: user.email,
    };
  });

export const verifyEmailCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => {
    const code = String(input?.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error("Enter the 6-digit code.");
    return { code };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      code_hash: string;
      attempts: number;
      expired: boolean;
    }>`
      select code_hash, attempts, (expires_at <= now()) as expired
      from email_verification_codes
      where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) {
      return { ok: false as const, error: "Request a new code." };
    }
    if (row.expired) {
      await sql`delete from email_verification_codes where user_id = ${context.userId}`;
      return { ok: false as const, error: "That code expired. Request a new one." };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await sql`delete from email_verification_codes where user_id = ${context.userId}`;
      return {
        ok: false as const,
        error: "Too many tries. Request a new code.",
      };
    }

    if (!sameHash(row.code_hash, hashCode(context.userId, data.code))) {
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await sql`delete from email_verification_codes where user_id = ${context.userId}`;
      } else {
        await sql`
          update email_verification_codes
          set attempts = ${attempts}
          where user_id = ${context.userId}
        `;
      }
      return {
        ok: false as const,
        error:
          attempts >= MAX_ATTEMPTS
            ? "Too many tries. Request a new code."
            : `That code is not right. ${MAX_ATTEMPTS - attempts} tries left.`,
      };
    }

    const updated = await sql<{ id: string }>`
      update "user"
      set "emailVerified" = true, "updatedAt" = now()
      where id = ${context.userId}
      returning id
    `;
    if (!updated[0]) {
      return { ok: false as const, error: "Sign in again to verify your email." };
    }
    await sql`delete from email_verification_codes where user_id = ${context.userId}`;
    return {
      ok: true as const,
      state: await loadOnboardingState(context.userId),
    };
  });

export const acceptTerms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      insert into user_consents (user_id, terms_version, accepted_at)
      values (${context.userId}, ${CURRENT_TERMS_VERSION}, now())
      on conflict (user_id) do update set
        terms_version = excluded.terms_version,
        accepted_at = now()
    `;
    return {
      ok: true as const,
      state: await loadOnboardingState(context.userId),
    };
  });

export const saveOnboardingProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName?: string; cleanDate?: string | null }) => {
    const displayName = String(input?.displayName ?? "").trim().slice(0, 40);
    if (!displayName) throw new Error("Enter the name you want to use.");

    const rawDate = input?.cleanDate;
    const cleanDate =
      rawDate == null || String(rawDate).trim() === ""
        ? null
        : String(rawDate).trim();
    if (cleanDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        throw new Error("Enter a valid clean date.");
      }
      const parsed = new Date(`${cleanDate}T00:00:00.000Z`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== cleanDate
      ) {
        throw new Error("Enter a valid clean date.");
      }
      if (cleanDate > new Date().toISOString().slice(0, 10)) {
        throw new Error("The clean date cannot be in the future.");
      }
      if (cleanDate < "1900-01-01") {
        throw new Error("Enter a clean date after 1900.");
      }
    }
    return { displayName, cleanDate };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, display_name, role)
      values (${context.userId}, ${data.displayName}, 'attendee')
      on conflict (user_id) do update set
        display_name = excluded.display_name
    `;
    if (data.cleanDate) {
      await sql`
        insert into clean_journals (user_id, clean_since, updated_at)
        values (${context.userId}, ${data.cleanDate}::date, now())
        on conflict (user_id) do update set
          clean_since = excluded.clean_since,
          updated_at = now()
      `;
    }
    await sql`
      update "user"
      set name = ${data.displayName}, "updatedAt" = now()
      where id = ${context.userId}
    `;
    return {
      ok: true as const,
      state: await loadOnboardingState(context.userId),
    };
  });

export const saveOnboardingRoles = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { wantsLeader?: boolean; wantsSponsor?: boolean }) => ({
    wantsLeader: input?.wantsLeader === true,
    wantsSponsor: input?.wantsSponsor === true,
  }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profileRows = await sql<{ leader_banned: boolean }>`
      select leader_banned from profiles where user_id = ${context.userId}
    `;
    if (!profileRows[0]) {
      return { ok: false as const, error: "Enter your name before choosing roles." };
    }
    if (data.wantsLeader && profileRows[0].leader_banned) {
      return {
        ok: false as const,
        error: "Leader access is suspended. You can still attend meetings.",
      };
    }
    if (data.wantsSponsor) {
      const eligibility = await sql<{ eligible: boolean }>`
        select exists (
          select 1 from clean_journals
          where user_id = ${context.userId}
            and clean_since <= current_date - interval '2 years'
        ) as eligible
      `;
      if (!eligibility[0]?.eligible) {
        return {
          ok: false as const,
          error:
            "Sponsor access needs at least 2 years clean. You can still attend or lead.",
        };
      }
    }

    await sql`
      update profiles
      set role = ${data.wantsLeader ? "leader" : "attendee"},
          wants_sponsor = ${data.wantsSponsor},
          onboarding_completed_at = now()
      where user_id = ${context.userId}
    `;
    return {
      ok: true as const,
      state: await loadOnboardingState(context.userId),
    };
  });
