import { useId } from "react";

/**
 * AuraSwitch mark: a breathing orb with a comet-like aura arc orbiting it.
 * Pure CSS animation, rotating about the exact centre of the 64×64 view box.
 */
export const LogoMark = ({ size = 34 }: { size?: number }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id={`${id}-core`} cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#F3EFFF" />
          <stop offset=".45" stopColor="#AB9FF2" />
          <stop offset="1" stopColor="#5B47D6" />
        </radialGradient>
        {/* Bright head at the top, fading tail – rotates together with the arc. */}
        <linearGradient id={`${id}-tail`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF9ECF" stopOpacity="1" />
          <stop offset=".45" stopColor="#CFC7FF" stopOpacity=".75" />
          <stop offset="1" stopColor="#AB9FF2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset=".55" stopColor="#AB9FF2" stopOpacity=".35" />
          <stop offset="1" stopColor="#AB9FF2" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="27" fill="none" stroke="#AB9FF2" strokeOpacity=".16" strokeWidth="2" />
      <g className="logo-orbit">
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke={`url(#${id}-tail)`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="72 170"
        />
      </g>
      <g className="logo-core">
        <circle cx="32" cy="32" r="22" fill={`url(#${id}-glow)`} />
        <circle cx="32" cy="32" r="15" fill={`url(#${id}-core)`} />
      </g>
    </svg>
  );
};

export const Logo = ({ href = "/" }: { href?: string }) => (
  <a className="logo" href={href} aria-label="AuraSwitch – strona główna">
    <LogoMark />
    AuraSwitch
  </a>
);
