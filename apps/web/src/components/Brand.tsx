import Link from "next/link";

/** Night Messenger brand — monochrome 夜 seal (ninja / East Asian identity). */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Night Messenger home">
      <span className="brand-mark nm-seal" aria-hidden="true" title="夜 — night">
        夜
      </span>
      {!compact && (
        <span>
          night<span className="brand-light">messenger</span>
          <span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}
