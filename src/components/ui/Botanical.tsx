/**
 * Decorative botanical motifs (inline SVG, no external requests, CSP-safe).
 * Use with aria-hidden / currentColor tinting.
 */
export function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M32 60 C32 38 42 20 60 8 C42 14 34 24 34 42 C34 50 33 56 32 60 Z"
        fill="currentColor"
      />
      <path
        d="M32 60 C32 38 22 20 4 8 C22 14 30 24 30 42 C30 50 31 56 32 60 Z"
        fill="currentColor"
      />
      <path d="M32 8 L32 60" stroke="currentColor" strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <path d="M12 78 C40 70 60 52 72 10" stroke="currentColor" strokeWidth="2" />
      <path d="M40 46 C36 34 26 22 8 10 C28 16 36 26 40 46 Z" fill="currentColor" />
      <path d="M56 34 C60 24 68 14 80 6 C62 10 54 18 56 34 Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Placeholder "image" panel — a botanical gradient block that real photography
 * will replace later (swap-in point). Self-contained; no external assets.
 */
export function BotanicalImage({
  className = "",
  tone = "cream",
}: {
  className?: string;
  tone?: "cream" | "forest" | "pale";
}) {
  const tones: Record<string, string> = {
    cream: "from-cream-100 to-brand-100",
    forest: "from-forest-700 to-brand-600",
    pale: "from-brand-50 to-cream-50",
  };
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-3xl bg-linear-to-br ${tones[tone]} ${className}`}
    >
      <div className="botanical-grid absolute inset-0" />
      <Leaf className="absolute -right-6 -top-8 h-40 w-40 text-brand-700/30" />
      <Sprig className="absolute -bottom-8 -left-6 h-36 w-36 text-forest-700/20" />
    </div>
  );
}
