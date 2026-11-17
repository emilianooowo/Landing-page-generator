import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy (security policy, "Formularios" and "Comunicaciones").
 *
 * - Scripts only from this origin. 'unsafe-inline' is needed by Next.js
 *   without nonces; nonces would force every page to render dynamically.
 *   'unsafe-eval' only in development (React debugging).
 * - The browser only talks to this origin: password hashing and the
 *   breached-password check run on the server.
 * - No frames, plugins or foreign form targets.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // HSTS only makes sense over HTTPS; the reverse proxy serves TLS 1.2+.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // AI answers are per request. Uploaded photos (/api/uploads/<file>) keep their own long cache.
      ...["/api/parse-brief", "/api/generate-section", "/api/edit-section", "/api/uploads"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-store" }],
      })),
    ];
  },
};

export default nextConfig;
