/**
 * Have I Been Pwned "range" check (k-anonymity): only the first 5 hex
 * characters of the password's SHA-1 leave the browser; the comparison with
 * the returned suffixes happens here. Padding hides the real response size.
 *
 * Returns how many times the password appears in known breaches, or null when
 * the service can't be reached (the check is then skipped, never blocking).
 */
export async function pwnedCount(password: string, timeoutMs = 4000): Promise<number | null> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hex.slice(0, 5);
  const suffix = hex.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return null;
    return countInRange(await response.text(), suffix);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function countInRange(body: string, suffix: string): number {
  for (const line of body.split("\n")) {
    const [candidate, count] = line.trim().split(":");
    if (candidate?.toUpperCase() === suffix) return Number(count) || 0;
  }
  return 0;
}
