"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#16a34a",
  "#22c55e",
  "#facc15",
  "#fb7185",
  "#60a5fa",
  "#a78bfa",
];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
}

export function Confetti() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    const generated: Piece[] = Array.from({ length: 70 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.4 + Math.random() * 1.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
    setPieces(generated);
    const t = setTimeout(() => setPieces(null), 4500);
    return () => clearTimeout(t);
  }, []);

  if (!pieces) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
