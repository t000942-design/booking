/**
 * Decorative background layers for the sign-in page:
 *   - One goal at the top, one at the bottom (overhead pitch view).
 *   - A small soccer ball that bounces around the screen on independent
 *     X / Y timers (so the path doesn't visibly repeat).
 * Sits behind page content (z-index 0), pointer-events: none.
 */
export function PitchScene() {
  return (
    <>
      <Goal side="top" />
      <Goal side="bottom" />
      <div className="pitch-ball-stage" aria-hidden>
        <div className="pitch-ball-x">
          <div className="pitch-ball-y">
            <div className="pitch-ball-spin">
              <BallSvg className="pitch-ball" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function BallSvg({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="pitch-ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f2f2f2" />
          <stop offset="100%" stopColor="#b8b8b8" />
        </radialGradient>
      </defs>

      {/* Sphere */}
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="url(#pitch-ball-shade)"
        stroke="#1a1a1a"
        strokeWidth="0.9"
      />

      {/* Central pentagon */}
      <polygon points="32,21 42,29 38,41 26,41 22,29" fill="#1a1a1a" />

      {/* Five rim pentagons */}
      <polygon points="32,5 37,9 35,14 29,14 27,9" fill="#1a1a1a" />
      <polygon points="55,18 58,24 53,30 48,26 49,20" fill="#1a1a1a" />
      <polygon points="50,49 52,44 49,39 43,42 41,47" fill="#1a1a1a" />
      <polygon points="14,49 23,47 21,42 15,39 12,44" fill="#1a1a1a" />
      <polygon points="9,18 6,24 11,30 16,26 15,20" fill="#1a1a1a" />

      {/* Connecting lines from central pentagon to rim pentagons */}
      <line x1="32" y1="21" x2="32" y2="14" stroke="#1a1a1a" strokeWidth="1.6" />
      <line x1="42" y1="29" x2="49" y2="26" stroke="#1a1a1a" strokeWidth="1.6" />
      <line x1="38" y1="41" x2="43" y2="47" stroke="#1a1a1a" strokeWidth="1.6" />
      <line x1="26" y1="41" x2="21" y2="47" stroke="#1a1a1a" strokeWidth="1.6" />
      <line x1="22" y1="29" x2="15" y2="26" stroke="#1a1a1a" strokeWidth="1.6" />

      {/* Subtle highlight to feel spherical */}
      <ellipse
        cx="22"
        cy="20"
        rx="8"
        ry="4"
        fill="white"
        opacity="0.18"
      />
    </svg>
  );
}

function Goal({ side }: { side: "top" | "bottom" }) {
  return (
    <svg
      aria-hidden
      className={`pitch-goal pitch-goal--${side}`}
      viewBox="0 0 100 40"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern
          id={`pitch-net-${side}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0L6 6M6 0L0 6"
            stroke="white"
            strokeWidth="0.5"
            opacity="0.55"
          />
        </pattern>
      </defs>
      <rect x="4" y="4" width="92" height="32" fill={`url(#pitch-net-${side})`} />
      <rect x="0" y="0" width="100" height="5" fill="white" />
      <rect x="0" y="0" width="5" height="38" fill="white" />
      <rect x="95" y="0" width="5" height="38" fill="white" />
      <rect x="0" y="37" width="100" height="2" fill="white" opacity="0.35" />
    </svg>
  );
}
