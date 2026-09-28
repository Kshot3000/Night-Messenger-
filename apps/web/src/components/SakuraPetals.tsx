"use client";

import type { CSSProperties } from "react";

/** Subtle white cherry-blossom petals for monochrome ninja backdrop. */
export function SakuraPetals({ count = 18 }: { count?: number }) {
  const petals = Array.from({ length: count }, (_, i) => {
    const left = ((i * 37) % 100) + (i % 5) * 0.4;
    // Negative delay so petals are mid-fall on first paint (screenshots + first glance)
    const delay = (-((i * 1.37) % 14)).toFixed(2);
    const duration = (14 + (i % 7) * 2.2).toFixed(1);
    const drift = `${(i % 2 === 0 ? 1 : -1) * (28 + (i % 5) * 18)}px`;
    const scale = 0.75 + (i % 4) * 0.2;
    return { left, delay, duration, drift, scale, i };
  });

  return (
    <div className="nm-sakura" aria-hidden>
      {petals.map((p) => {
        const style = {
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          ["--drift" as string]: p.drift,
          transform: `scale(${p.scale})`,
        } as CSSProperties;
        return <span key={p.i} className="nm-sakura__petal" style={style} />;
      })}
    </div>
  );
}
