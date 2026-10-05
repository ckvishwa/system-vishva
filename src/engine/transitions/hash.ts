/** Label for the "hash" signature: a real SHA-256, shortened to its first and last 8 hex digits. Never invents one. */
const SHA256 = /^[a-f0-9]{64}$/i;

export function isSha256(value: string | undefined | null): value is string {
  return !!value && SHA256.test(value);
}

export function hashLabel(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`.toLowerCase();
}
