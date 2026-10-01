"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { MAX_BODY_LENGTH } from "@/lib/messenger-store";
export function ComposeBox({
  value,
  onChange,
  onSend,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (body: string) => void;
  name: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height =
        Math.min(input.current.scrollHeight, 140) + "px";
    }
  }, [value]);
  useEffect(() => {
    if (!emojiOpen) return;
    function close(e: PointerEvent) {
      if (!picker.current?.contains(e.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [emojiOpen]);
  function send() {
    if (!value.trim()) return;
    onSend(value);
    setEmojiOpen(false);
    input.current?.focus();
  }
  return (
    <div className="compose-area">
      <div className="compose-box">
        <textarea
          id="message-composer"
          aria-label={`Message ${name}`}
          ref={input}
          rows={1}
          maxLength={MAX_BODY_LENGTH}
          placeholder={`Message ${name}…`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-tools">
          <div className="emoji-wrap" ref={picker}>
            <button
              className="icon-button"
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen(!emojiOpen)}
            >
              <Icon name="smile" />
            </button>
            {emojiOpen && (
              <div
                className="emoji-picker"
                role="group"
                aria-label="Choose an emoji"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEmojiOpen(false);
                    input.current?.focus();
                  }
                }}
              >
                {["✨", "☾", "❤️", "👍", "🌱", "🎉", "😊", "🔥"].map(
                  (emoji) => (
                    <button
                      key={emoji}
                      aria-label={`Insert ${emoji}`}
                      onClick={() => {
                        const el = input.current;
                        const start = el?.selectionStart ?? value.length;
                        const end = el?.selectionEnd ?? value.length;
                        onChange(
                          (
                            value.slice(0, start) +
                            emoji +
                            value.slice(end)
                          ).slice(0, MAX_BODY_LENGTH),
                        );
                        setEmojiOpen(false);
                        requestAnimationFrame(() => {
                          el?.focus();
                          el?.setSelectionRange(
                            start + emoji.length,
                            start + emoji.length,
                          );
                        });
                      }}
                    >
                      {emoji}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
          <span className="compose-divider" />
          <button
            className="send-button"
            aria-label="Save message locally"
            disabled={!value.trim()}
            onClick={send}
          >
            <Icon name="arrow" size={20} />
          </button>
        </div>
      </div>
      <div className="compose-meta">
        <span>
          <Icon name="info" size={11} /> Local demo · Messages are not delivered
        </span>
        <span>
          {value.length > 3500
            ? `${value.length}/${MAX_BODY_LENGTH}`
            : "Enter to send · Shift + Enter for a new line"}
        </span>
      </div>
    </div>
  );
}
