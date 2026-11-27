/**
 * Transactional email for sign-up verification codes, password resets, and
 * attendance verification letters.
 *
 * Uses Resend's HTTP API directly, so the server bundle needs no extra SDK.
 * `RESEND_API_KEY` is required in production. In local development the preview
 * value is returned to the caller for the on-screen helper.
 */
type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

type EmailResult = { ok: true; devCode?: string } | { ok: false; error: string };
type SendResult = { ok: true; preview?: string } | { ok: false; error: string };

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    from: process.env.EMAIL_FROM?.trim() || "ALL DAY NA <onboarding@resend.dev>",
  };
}

async function sendEmail(
  email: string,
  message: EmailMessage,
  options: { preview?: string; errorMessage: string },
): Promise<SendResult> {
  const config = resendConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, preview: options.preview };
    }
    return {
      ok: false,
      error: "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [email],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[email] Resend rejected the message", response.status, body.slice(0, 500));
      return { ok: false, error: options.errorMessage };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] Resend request failed", error);
    return { ok: false, error: options.errorMessage };
  }
}

export async function sendVerificationEmail(email: string, code: string): Promise<EmailResult> {
  const sent = await sendEmail(
    email,
    {
      subject: "Your ALL DAY NA verification code",
      html: [
        '<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c2118">',
        '<h1 style="font-size:24px;margin:0 0 12px">ALL DAY NA</h1>',
        "<p>Use this code to verify your email address:</p>",
        `<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</p>`,
        "<p>The code expires in 10 minutes. If you did not create an account, you can ignore this email.</p>",
        "</div>",
      ].join(""),
      text: `Your ALL DAY NA verification code is ${code}. It expires in 10 minutes. If you did not create an account, ignore this email.`,
    },
    {
      preview: code,
      errorMessage: "We could not send the verification email. Try again.",
    },
  );
  if (!sent.ok) return sent;
  if (sent.preview) {
    console.log(`[email] verification code for ${email}: ${sent.preview}`);
  }
  return { ok: true, devCode: sent.preview };
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<EmailResult> {
  const href = resetUrl.replace(/&/g, "&amp;");
  const sent = await sendEmail(
    email,
    {
      subject: "Reset your ALL DAY NA password",
      html: [
        '<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c2118">',
        '<h1 style="font-size:24px;margin:0 0 12px">ALL DAY NA</h1>',
        "<p>We received a request to reset the password for your ALL DAY NA account.</p>",
        `<p style="margin:24px 0"><a href="${href}" style="background:#1c2118;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>`,
        "<p>The link expires in 1 hour and can be used once. If you did not ask for a reset, you can ignore this email.</p>",
        "</div>",
      ].join(""),
      text: `Reset your ALL DAY NA password: ${resetUrl}\n\nThe link expires in 1 hour and can be used once. If you did not ask for a reset, ignore this email.`,
    },
    {
      preview: resetUrl,
      errorMessage: "We could not send the reset email. Try again.",
    },
  );
  if (!sent.ok) return sent;
  if (sent.preview) {
    console.log(`[email] password reset link for ${email}: ${sent.preview}`);
  }
  return { ok: true };
}

export async function sendAttendanceLetterEmail(
  email: string,
  letter: EmailMessage,
): Promise<{ ok: true; devPreview: boolean } | { ok: false; error: string }> {
  const sent = await sendEmail(email, letter, {
    preview: letter.text,
    errorMessage: "We could not send the attendance letter. Try again.",
  });
  if (!sent.ok) return sent;
  return { ok: true, devPreview: Boolean(sent.preview) };
}
