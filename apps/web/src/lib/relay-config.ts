// SPDX-License-Identifier: Apache-2.0
/** Fetch the published Pages relay URL (`relay.json`) so testers pick up a new tunnel without a rebuild. */
import { parseRelayParam } from "./private-store";

function publicBasePath(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH;
  if (fromEnv != null && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/Night-Messenger-")) {
    return "/Night-Messenger-";
  }
  return "";
}

export async function loadPublishedRelay(): Promise<string | null> {
  const url = `${publicBasePath()}/relay.json`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { relay?: unknown };
    return parseRelayParam(typeof j?.relay === "string" ? j.relay : null);
  } catch {
    return null;
  }
}
