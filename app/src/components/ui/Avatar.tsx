/** Deterministic gradient avatar from a wallet address – no images, no network. */
export const Avatar = ({ address, size = 40 }: { address: string; size?: number }) => {
  let h = 0;
  for (const ch of address) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % 360;
  const b = (a + 60 + ((h >> 8) % 90)) % 360;
  return (
    <span
      className="avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${a} 90% 85%), hsl(${a} 70% 62%) 45%, hsl(${b} 65% 42%))`,
      }}
    />
  );
};
