"use client";

export function Avatar({
  name,
  hue = 265,
  size = 40,
  online,
}: {
  name: string;
  hue?: number;
  size?: number;
  online?: boolean;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white shadow-inner"
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 70% 48%), hsl(${hue + 40} 65% 32%))`,
          fontSize: size * 0.38,
        }}
        aria-hidden
      >
        {initial}
      </div>
      {online ? (
        <span
          className="nm-online-dot absolute bottom-0 right-0 block rounded-full border-2 border-nm-panel bg-nm-success"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
          title="Online"
        />
      ) : null}
    </div>
  );
}
