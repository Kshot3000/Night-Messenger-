export function Avatar({
  name,
  hue = 200,
  size = 42,
}: {
  name: string;
  hue?: number;
  size?: number;
  online?: boolean;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: `hsl(${hue} 13% 19%)`,
        color: `hsl(${hue} 27% 80%)`,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
