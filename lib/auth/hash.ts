/**
 * Argon2id parameters (OWASP minimum: 19 MiB of memory, 2 iterations, 1 lane).
 * Hashes are PHC strings ($argon2id$v=19$m=…,t=…,p=…$salt$hash) that carry
 * their own salt and parameters, so hardening them later only needs
 * `needsRehash` on the next successful sign-in. Hashing runs on the server
 * (lib/server/passwords.ts).
 */
export const ARGON2_PARAMS = { memorySize: 19_456, iterations: 2, parallelism: 1, hashLength: 32 } as const;

export function needsRehash(stored: string): boolean {
  const match = /\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(stored);
  if (!stored.startsWith("$argon2id$") || !match) return true;
  const [, m, t, p] = match.map(Number);
  return m < ARGON2_PARAMS.memorySize || t < ARGON2_PARAMS.iterations || p !== ARGON2_PARAMS.parallelism;
}
