/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Password reset reuses the same Resend sender as sign-up verification. Better
 * Auth builds a one-time link that lands on `/reset-password?token=…`.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
import { sendPasswordResetEmail } from "../email.server";

export const emailAndPasswordEnabled = true;

export const emailAndPasswordOptions = {
  enabled: true,
  // One hour, matching the copy in the reset email.
  resetPasswordTokenExpiresIn: 60 * 60,
  // A reset means the old password may be compromised; end existing sessions.
  revokeSessionsOnPasswordReset: true,
  async sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
    const result = await sendPasswordResetEmail(user.email, url);
    if (!result.ok) throw new Error(result.error);
  },
};
