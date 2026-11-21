// SPDX-License-Identifier: Apache-2.0
/**
 * Derive a midnight-js private-state password from a local secret already on
 * this device (the member sk). The password never leaves the browser. It must
 * meet midnight-js rules: ≥16 chars, ≥3 character classes, no 4-in-a-row
 * identical or sequential characters.
 */
const UPPER = "QHNRVWXZKFBMYPTCGSJD";
const LOWER = "qhnrvwxzkfbmypatcgsjd";
const DIGIT = "39726845";
const SPECIAL = "!@#&*%?";

export function storagePasswordFromSecret(secret: Uint8Array): string {
  if (!(secret instanceof Uint8Array) || secret.length < 16) {
    throw new Error("A local secret is required to unlock contract state storage.");
  }
  let out = "Nm#";
  for (let i = 0; i < secret.length; i++) {
    const b = secret[i] ^ ((i * 19 + 11) & 0xff);
    out += UPPER[(b + i) % UPPER.length];
    out += LOWER[(b * 3 + i * 5) % LOWER.length];
    out += SPECIAL[(b + i * 2) % SPECIAL.length];
    out += DIGIT[(b * 5 + i * 7) % DIGIT.length];
  }
  return out.slice(0, 80);
}

/** Matches the midnight-js 5 policy closely enough for a unit test. */
export function passwordLooksValid(password: string): boolean {
  if (password.length < 16) return false;
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) return false;
  if (/(.)\1{3,}/.test(password)) return false;
  const seq = "0123456789abcdefghijklmnopqrstuvwxyz";
  const lower = password.toLowerCase();
  for (let i = 0; i < lower.length - 3; i++) {
    const slice = lower.slice(i, i + 4);
    if (/^[a-z0-9]{4}$/.test(slice) && (seq.includes(slice) || [...seq].reverse().join("").includes(slice))) {
      return false;
    }
  }
  return true;
}
