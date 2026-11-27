import { getRequest } from "@tanstack/react-start/server";
import { configuredOrigin, originFromRequest } from "./site-origin.ts";

/**
 * Origin for links in attendance letters and their PDFs. The configured public
 * URL wins; otherwise the current request's own (forwarded) origin is used, so a
 * letter generated in preview or local development points at the server that
 * issued it instead of the production domain.
 */
export function siteOrigin(request?: Request): string {
  const configured = configuredOrigin();
  if (configured) return configured;
  if (request) return originFromRequest(request);
  try {
    const current = getRequest();
    if (current) return originFromRequest(current);
  } catch {
    // No request context (scripts, one-off jobs): use the documented dev port.
  }
  return "http://localhost:8080";
}
