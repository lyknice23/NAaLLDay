/**
 * The identity providers this app offers for sign-in.
 *
 * Two modes:
 *   - **Direct** (`VITE_AUTH_MODE=direct` + `GOOGLE_*` / `X_*` env vars): the
 *     app talks to Google and X itself. This is what production uses on the
 *     custom domain, where the shared Grok broker client cannot be used.
 *   - **Broker** (default): the app federates to the shared Grok auth broker,
 *     which holds the upstream secrets. Used by the live preview and as the
 *     fallback when direct credentials are not configured.
 *
 * Kept in its own dependency-free module so the client can import it without
 * pulling the server-only Better Auth instance (and `pg`) into the browser
 * bundle.
 */
export type AuthProviderKind = "social" | "broker";

/** A broker-backed provider (`genericOAuth`, callback path `/oauth2/callback/…`). */
export type GrokProvider = {
  /** This app's local provider id; also the OAuth callback path segment. */
  providerId: string;
  /** Upstream hint the broker forwards to (Better Auth social id). */
  idp: string;
  /** Human label for the sign-in button. */
  label: string;
  kind: "broker";
};

/** A direct social provider (Better Auth `socialProviders`, callback `/callback/…`). */
export type DirectProvider = {
  /** Better Auth social provider id (`google`, `twitter`). */
  providerId: string;
  label: string;
  kind: "social";
};

export type AuthProvider = GrokProvider | DirectProvider;

/** Broker-backed providers, used by live preview and as the fallback. */
export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "grok-google", idp: "google", label: "Google", kind: "broker" },
  { providerId: "grok-x", idp: "twitter", label: "X", kind: "broker" },
];

/** Direct providers, enabled by `VITE_AUTH_MODE=direct` on a deployed origin. */
export const DIRECT_PROVIDERS: readonly DirectProvider[] = [
  { providerId: "google", label: "Google", kind: "social" },
  { providerId: "twitter", label: "X", kind: "social" },
];
