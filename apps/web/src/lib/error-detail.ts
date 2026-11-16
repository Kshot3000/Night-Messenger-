// SPDX-License-Identifier: Apache-2.0
/**
 * Show the real reason a chain call failed.
 *
 * midnight-js wraps provider failures in ProviderFailedError and keeps the
 * provider's own error on `cause`. Walk that chain so the UI shows the
 * underlying message (for example the prover's), not only the wrapper.
 * Long hex runs are masked so no transaction or witness bytes reach the UI.
 */
const LONG_HEX = /\b(?:0x)?[0-9a-fA-F]{40,}\b/g;

export function maskBytes(text: string): string {
  return text.replace(LONG_HEX, "[bytes]");
}

export function describeError(error: unknown, maxLength = 600): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && !seen.has(current) && seen.size < 6) {
    seen.add(current);
    const message =
      current instanceof Error ? current.message : typeof current === "string" ? current : "";
    const clean = maskBytes(message.replace(/^Error:\s*/, "").trim());
    if (clean && !parts.some((p) => p.includes(clean))) parts.push(clean);
    current = current instanceof Error ? (current as Error & { cause?: unknown }).cause : undefined;
  }
  const text = parts.join(" ← cause: ") || "Unknown error";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
