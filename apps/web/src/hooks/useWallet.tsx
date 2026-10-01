"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  connectMidnightWallet,
  type WalletSession,
} from "@midnight-messenger/shared";
interface WalletContextValue {
  session: WalletSession;
  busy: boolean;
  connect: (key?: string) => Promise<WalletSession>;
  disconnect: () => void;
}
const WalletContext = createContext<WalletContextValue | null>(null);
export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession>({
    status: "disconnected",
  });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<Promise<WalletSession> | null>(null);
  const generation = useRef(0);
  const connect = useCallback((injectionKey?: string) => {
    if (inFlight.current) return inFlight.current;
    const current = ++generation.current;
    setBusy(true);
    setSession({ status: "connecting" });
    const attempt = connectMidnightWallet({
      networkId: "preprod",
      injectionKey,
    })
      .then((next) => {
        if (current === generation.current) setSession(next);
        return next;
      })
      .finally(() => {
        if (current === generation.current) {
          setBusy(false);
          inFlight.current = null;
        }
      });
    inFlight.current = attempt;
    return attempt;
  }, []);
  const disconnect = useCallback(() => {
    generation.current += 1;
    inFlight.current = null;
    setBusy(false);
    setSession({ status: "disconnected" });
  }, []);
  return (
    <WalletContext.Provider value={{ session, busy, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet requires WalletProvider");
  return context;
}
