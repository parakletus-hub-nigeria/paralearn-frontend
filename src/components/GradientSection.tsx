"use client";

import { ReactNode } from "react";

interface GradientSectionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Landing page canvas: Chalk White with a faint ruled grid (the register page)
 * and a single violet wash behind the hero. Static layers only.
 */
export const GradientSection = ({ children, className }: GradientSectionProps) => {
  return (
    <div className={`relative min-h-screen bg-[#fdfdff] overflow-hidden ${className ?? ""}`}>
      {/* Ruled-paper grid, fading toward the edges */}
      <div className="fixed inset-0 bg-grid-slate-100 [mask-image:radial-gradient(ellipse_at_top,black_45%,transparent_80%)] pointer-events-none" />

      {/* One violet wash behind the hero. Ambient only. */}
      <div
        className="fixed -top-[25%] left-1/2 -translate-x-1/2 w-[90%] h-[60%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(100,27,196,0.06), transparent 65%)",
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};
