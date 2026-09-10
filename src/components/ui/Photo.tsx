import Image from "next/image";
import { Leaf, Sprig } from "./Botanical";

type Tone = "warm" | "botanical" | "forest" | "natural";

const gradients: Record<Tone, string> = {
  warm: "from-amber-50 via-cream-100 to-brand-100",
  botanical: "from-brand-100 via-brand-50 to-cream-100",
  forest: "from-forest-700 via-forest-800 to-forest-900",
  natural: "from-orange-50 via-amber-50 to-cream-100",
};

/**
 * Reusable image-presentation system (Visual Pass 2).
 *
 * When `src` is provided it renders a real, self-hosted Next <Image>;
 * otherwise it renders a premium botanical "photography" placeholder that
 * preserves the intended composition (no grey skeleton). Drop final assets
 * into public/images/landing/ and pass their paths to swap in real photos
 * without restructuring the page.
 */
export function Photo({
  src,
  alt,
  tone = "botanical",
  className = "",
  priority = false,
  overlay = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: {
  src?: string;
  alt: string;
  tone?: Tone;
  className?: string;
  priority?: boolean;
  overlay?: boolean;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className={`photo-light botanical-grid absolute inset-0 bg-linear-to-br ${gradients[tone]}`}
        >
          <Leaf className="absolute -right-8 -top-10 h-48 w-48 text-brand-700/25" />
          <Sprig className="absolute -bottom-10 -left-8 h-44 w-44 text-forest-700/20" />
          <Leaf className="absolute bottom-6 right-10 h-24 w-24 rotate-180 text-brand-600/20" />
        </div>
      )}
      <div className="photo-vignette pointer-events-none absolute inset-0" />
      {overlay ? (
        <div className="absolute inset-0 bg-forest-900/55" aria-hidden="true" />
      ) : null}
    </div>
  );
}
