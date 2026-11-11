/**
 * Transactional email for sign-up verification codes.
 *
 * Uses Resend's HTTP API directly, so the server bundle needs no extra SDK.
 * `RESEND_API_KEY` is required in production. In local development the code is
 * logged and returned to the caller for the on-screen preview helper.
 */
type EmailResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: string };

export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email] verification code for ${email}: ${code}`);
      return { ok: true, devCode: code };
    }
    return {
      ok: false,
      error: "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const from =
    process.env.EMAIL_FROM?.trim() || "ALL DAY NA <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your ALL DAY NA verification code",
        html: [
          "<div style=\"font-family:system-ui,sans-serif;line-height:1.6;color:#1c2118\">",
          "<h1 style=\"font-size:24px;margin:0 0 12px\">ALL DAY NA</h1>",
          "<p>Use this code to verify your email address:</p>",
          `<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>`,
          "<p>The code expires in 10 minutes. If you did not create an account, you can ignore this email.</p>",
          "</div>",
        ].join(""),
        text: `Your ALL DAY NA verification code is ${code}. It expires in 10 minutes. If you did not create an account, ignore this email.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        "[email] Resend rejected the message",
        response.status,
        body.slice(0, 500),
      );
      return {
        ok: false,
        error: "We could not send the verification email. Try again.",
      };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] Resend request failed", error);
    return {
      ok: false,
      error: "We could not send the verification email. Try again.",
    };
  }
}
