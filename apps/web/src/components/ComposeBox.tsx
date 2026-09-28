"use client";

import { useRef, useState } from "react";

export function ComposeBox({
  onSend,
  disabled,
  placeholder = "Message…",
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const body = value.trim();
    if (!body || disabled) return;
    onSend(body);
    setValue("");
    ref.current?.focus();
  }

  return (
    <div className="border-t border-nm-border bg-nm-elevated/80 px-3 py-3 sm:px-4">
      <div className="flex items-end gap-2 rounded-2xl border border-nm-border bg-black/30 px-3 py-2 shadow-inner focus-within:border-nm-accent/50">
        <button
          type="button"
          className="mb-1 rounded-full p-2 text-nm-muted hover:bg-nm-hover hover:text-nm-accent-soft"
          aria-label="Attach media (coming soon)"
          title="Media upload — stub for later"
          disabled
        >
          <PlusIcon />
        </button>
        <label className="sr-only" htmlFor="nm-compose">
          Message
        </label>
        <textarea
          id="nm-compose"
          ref={ref}
          rows={1}
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] text-nm-text outline-none placeholder:text-nm-muted"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="nm-btn nm-btn-primary mb-0.5 h-10 w-10 shrink-0 !rounded-full !p-0 disabled:opacity-40"
          aria-label="Send message"
          disabled={disabled || !value.trim()}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-nm-muted">
        Enter to send · Shift+Enter for newline · Bodies stay E2EE (stubbed locally in MVP)
      </p>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
