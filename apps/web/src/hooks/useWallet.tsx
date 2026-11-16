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
  DEFAULT_MIDNIGHT_NETWORK,
  type MidnightConnectedApiStub,
  type WalletSession,
} from "@midnight-messenger/shared";

interface WalletContextValue {
  session: WalletSession;
  /** Live DApp Connector API for this session (in-memory only). */
  api: MidnightConnectedApiStub | null;
  busy: boolean;
  connect: (key?: string) => Promise<WalletSession>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function sessionOnly(result: WalletSession): WalletSession {
  const { ...rest } = result as WalletSession & { api?: unknown };
  delete (rest as { api?: unknown }).api;
  return rest;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession>({
    status: "disconnected",
  });
  const [busy, setBusy] = useState(false);
  const apiRef = useRef<MidnightConnectedApiStub | null>(null);
  const [api, setApi] = useState<MidnightConnectedApiStub | null>(null);
  const inFlight = useRef<Promise<WalletSession> | null>(null);
  const generation = useRef(0);

  const connect = useCallback((injectionKey?: string) => {
    if (inFlight.current) return inFlight.current;
    const current = ++generation.current;
    setBusy(true);
    setSession({ status: "connecting" });
    const attempt = connectMidnightWallet({
      networkId: DEFAULT_MIDNIGHT_NETWORK,
      injectionKey,
    })
      .then((next) => {
        if (current === generation.current) {
          const live = next.status === "connected" ? (next.api ?? null) : null;
          apiRef.current = live;
          setApi(live);
          setSession(sessionOnly(next));
        }
        return sessionOnly(next);
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
    apiRef.current = null;
    setApi(null);
    setBusy(false);
    setSession({ status: "disconnected" });
  }, []);

  return (
    <WalletContext.Provider value={{ session, api, busy, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet requires WalletProvider");
  return context;
}
