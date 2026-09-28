"use client";

/** Map optional hue to a stable grayscale band (monochrome theme). */
function grayFromHue(hue: number) {
  const light = 38 + (Math.abs(Math.round(hue)) % 40);
  const deep = Math.max(18, light - 22);
  return { light, deep };
}

export function Avatar({
  name,
  hue = 200,
  size = 40,
  online,
}: {
  name: string;
  hue?: number;
  size?: number;
  online?: boolean;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const { light, deep } = grayFromHue(hue ?? 200);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-nm-on-accent shadow-inner ring-1 ring-white/15"
        style={{
          background: `linear-gradient(145deg, hsl(0 0% ${light}%), hsl(0 0% ${deep}%))`,
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
