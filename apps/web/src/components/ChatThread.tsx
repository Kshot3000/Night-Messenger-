"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation } from "@midnight-messenger/shared";
import { MOCK_PEER_SELF_ID, createStubMessengerApi } from "@midnight-messenger/shared";
import { Avatar } from "./Avatar";
import { PrivacyBadge } from "./PrivacyBadge";
import { ComposeBox } from "./ComposeBox";
import { formatMessageTime } from "@/lib/format";

const api = createStubMessengerApi();

export function ChatThread({
  conversation,
  onBack,
}: {
  conversation: Conversation | null;
  onBack?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!conversation) {
      setMessages([]);
      return;
    }
    api.listMessages(conversation.id).then((m) => {
      if (!cancelled) setMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="nm-seal flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-serif">夜</div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Pick a conversation</h2>
          <p className="mt-1 max-w-sm text-sm text-nm-muted">
            Your list shows mock chats so you can feel the product. Connect Lace when you&apos;re ready for real
            identity.
          </p>
        </div>
        <ul className="mt-2 space-y-2 text-left text-sm text-nm-muted">
          <li className="flex gap-2"><span className="text-nm-accent">●</span> Bodies encrypted off-chain</li>
          <li className="flex gap-2"><span className="text-nm-accent">●</span> Commit existence when you seal</li>
          <li className="flex gap-2"><span className="text-nm-accent">●</span> Disclose proofs only on purpose</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-nm-border px-3 py-3 sm:px-4">
        {onBack ? (
          <button
            type="button"
            className="rounded-full p-2 text-nm-muted hover:bg-nm-hover lg:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            ←
          </button>
        ) : null}
        <Avatar name={conversation.peer.displayName} hue={conversation.peer.avatarHue} online size={42} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-semibold tracking-tight">{conversation.peer.displayName}</h2>
          <p className="truncate font-mono text-[11px] text-nm-muted">
            {conversation.peer.addressPreview ?? "shielded peer"} · selective privacy
          </p>
        </div>
        <span className="hidden rounded-full border border-nm-border px-2.5 py-1 text-[11px] text-nm-accent-soft sm:inline">
          1:1 DM
        </span>
      </header>

      <div className="nm-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.map((m) => {
          const mine = m.senderId === MOCK_PEER_SELF_ID;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} nm-fade-up`}>
              <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-md ${
                    mine
                      ? "rounded-br-md bg-gradient-to-br from-nm-accent to-nm-accent-deep text-nm-on-accent"
                      : "rounded-bl-md border border-nm-border bg-nm-panel text-nm-text"
                  }`}
                >
                  {m.body}
                </div>
                <div className={`flex items-center gap-2 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                  <span className="text-[11px] text-nm-muted">{formatMessageTime(m.createdAt)}</span>
                  <PrivacyBadge visibility={m.visibility} />
                  {mine ? (
                    <button
                      type="button"
                      className="text-[11px] text-nm-accent-soft hover:underline"
                      onClick={async () => {
                        const res = await api.proveDisclosure({ messageId: m.id, kind: "delivery" });
                        setToast(
                          res.ok
                            ? `Delivery proof stub ready (${res.proofStub}) — not a real ZK proof yet`
                            : "Proof failed",
                        );
                        setTimeout(() => setToast(null), 4000);
                      }}
                    >
                      Prove delivery
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {toast ? (
        <div className="mx-4 mb-2 rounded-xl border border-nm-border bg-nm-panel px-3 py-2 text-xs text-nm-accent-soft" role="status">
          {toast}
        </div>
      ) : null}

      <ComposeBox
        onSend={async (body) => {
          const msg = await api.sendMessage(conversation.id, body);
          setMessages((prev) => [...prev, msg]);
        }}
      />
    </div>
  );
}
