/**
 * Public origin resolution for links we put in email — attendance letters and
 * their verification pages.
 *
 * Pure and client-safe; the wrapper that reads the current server request lives
 * in `site-origin.server.ts`. A letter must never hard-code the production
 * domain: generated in preview or local development, its link has to point at
 * the server that issued it.
 */

/** Read a configured origin (`BETTER_AUTH_URL`), reduced to scheme + host. */
export function configuredOrigin(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.BETTER_AUTH_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Origin of an incoming request. Behind a proxy (the live preview, Vercel) the
 * forwarded host and protocol are the public ones, so they win over the
 * internal URL the server itself sees.
 */
export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : url.protocol === "http:"
        ? "http"
        : "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    url.host;
  return `${protocol}://${host}`;
}

/** Join an origin and an app path without doubling or dropping a slash. */
export function absoluteUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
