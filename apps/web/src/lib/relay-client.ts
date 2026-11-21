// SPDX-License-Identifier: Apache-2.0
export type RelayCursor = { relay: string; instance?: string; after: number };

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
export function canAuthorizeRelay(relay: string): boolean {
  try {
    const url = new URL(relay);
    return url.protocol === "https:" && url.origin === relay.replace(/\/$/, "") &&
      url.hostname !== "trycloudflare.com" && !url.hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

export function mailboxUrl(relay: string, mailbox: string): string {
  return relay.replace(/\/$/, "") + "/v1/mailboxes/" + mailbox + "/messages";
}

export function pollUrl(relay: string, mailbox: string, cursor?: RelayCursor): string {
  const sameRelay = cursor?.relay === relay;
  const params = new URLSearchParams({ after: String(sameRelay ? cursor.after : 0) });
  if (sameRelay && cursor.instance) params.set("instance", cursor.instance);
  return mailboxUrl(relay, mailbox) + "?" + params;
}

export function relayAuthorization(relay: string, token: string): Record<string, string> {
  if (!canAuthorizeRelay(relay) || !TOKEN.test(token.trim())) return {};
  return { authorization: "Bearer " + token.trim() };
}

const retryable = new Set([502, 503, 504]);
export async function submitEnvelope({
  relay, mailbox, envelope, commitment, token, request = fetch,
}: {
  relay: string; mailbox: string; envelope: string; commitment: string; token?: string; request?: typeof fetch;
}): Promise<void> {
  const init: RequestInit = {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    headers: { "content-type": "application/json", ...relayAuthorization(relay, token ?? "") },
    body: JSON.stringify({ envelope }),
  };
  const send = () => request(mailboxUrl(relay, mailbox), { ...init, signal: AbortSignal.timeout(10_000) });
  let response = await send().catch(() => null);
  if (!response || retryable.has(response.status)) {
    if (response) await response.body?.cancel().catch(() => {});
    response = await send();
  }
  const result = await response.json().catch(() => null);
  // The Preview relay signals a committed duplicate with 409.
  if ((response.ok || response.status === 409) && result?.commitment === commitment && !result.deleted) return;
  if (result?.deleted) throw new Error("The relay already removed this envelope");
  throw new Error("Relay did not accept the envelope (" + response.status + ")");
}
