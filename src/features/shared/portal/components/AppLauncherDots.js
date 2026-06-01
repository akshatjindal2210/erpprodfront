"use client";

const SIZES = {
  sm: { box: "w-[18px] h-[18px]", gap: "gap-[3px]", dot: "w-[3px] h-[3px]" },
  md: { box: "w-[22px] h-[22px]", gap: "gap-[3.5px]", dot: "w-[3.5px] h-[3.5px]" },
};

/** Google-style 3×3 app launcher icon. */
export default function AppLauncherDots({ className = "", size = "md" }) {
  const s = SIZES[size] || SIZES.md;

  return (
    <span
      className={`inline-grid grid-cols-3 place-items-center ${s.gap} ${s.box} ${className}`}
      aria-hidden
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={`${s.dot} rounded-full bg-current shrink-0`} />
      ))}
    </span>
  );
}
