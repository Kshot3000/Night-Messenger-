"use client";

import { useCallback, useState } from "react";
import {
  connectMidnightWallet,
  type WalletSession,
} from "@midnight-messenger/shared";

export function useWallet() {
  const [session, setSession] = useState<WalletSession>({ status: "disconnected" });
  const [busy, setBusy] = useState(false);

  const connect = useCallback(async () => {
    setBusy(true);
    setSession((s) => ({ ...s, status: "connecting", error: undefined }));
    try {
      const next = await connectMidnightWallet({ networkId: "preprod" });
      setSession(next);
      return next;
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setSession({ status: "disconnected" });
  }, []);

  return { session, busy, connect, disconnect };
}
